#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频优化工具
基于分析结果优化音频文件以提高ASR识别率
"""

import os
import sys
import librosa
import numpy as np
from pydub import AudioSegment
from pydub.effects import normalize, compress_dynamic_range
import argparse

def optimize_audio_for_asr(input_file, output_file=None, target_sample_rate=24000, 
                          enhance_volume=True, remove_silence=True, 
                          normalize_audio=True, compress_audio=True):
    """
    优化音频文件以提高ASR识别率
    
    Args:
        input_file: 输入音频文件路径
        output_file: 输出音频文件路径（如果为None，则自动生成）
        target_sample_rate: 目标采样率
        enhance_volume: 是否增强音量
        remove_silence: 是否去除静音
        normalize_audio: 是否标准化音频
        compress_audio: 是否压缩动态范围
    """
    
    if output_file is None:
        name, ext = os.path.splitext(input_file)
        output_file = f"{name}_optimized{ext}"
    
    print(f"正在优化音频文件: {input_file}")
    print(f"输出文件: {output_file}")
    
    try:
        # 加载音频文件
        audio = AudioSegment.from_file(input_file)
        print(f"原始音频信息:")
        print(f"  时长: {len(audio) / 1000:.2f} 秒")
        print(f"  采样率: {audio.frame_rate} Hz")
        print(f"  声道数: {audio.channels}")
        print(f"  样本宽度: {audio.sample_width} 字节")
        
        # 1. 转换为单声道（如果是立体声）
        if audio.channels > 1:
            print("转换为单声道...")
            audio = audio.set_channels(1)
        
        # 2. 调整采样率
        if audio.frame_rate != target_sample_rate:
            print(f"调整采样率从 {audio.frame_rate} Hz 到 {target_sample_rate} Hz...")
            audio = audio.set_frame_rate(target_sample_rate)
        
        # 3. 标准化音频（增强音量）
        if normalize_audio:
            print("标准化音频...")
            audio = normalize(audio)
        
        # 4. 增强音量（如果音频太小声）
        if enhance_volume:
            # 检查音频的RMS能量
            rms = audio.rms
            if rms < 1000:  # 如果RMS太低，增强音量
                gain_db = 20 - (20 * np.log10(rms / 32767))  # 计算需要的增益
                gain_db = min(gain_db, 20)  # 限制最大增益为20dB
                print(f"增强音量 {gain_db:.1f} dB...")
                audio = audio + gain_db
        
        # 5. 压缩动态范围
        if compress_audio:
            print("压缩动态范围...")
            audio = compress_dynamic_range(audio, threshold=-20.0, ratio=4.0, attack=5.0, release=50.0)
        
        # 6. 去除静音段
        if remove_silence:
            print("去除静音段...")
            # 检测静音段（低于-40dB的部分）
            silence_threshold = audio.max_possible_amplitude * 0.01  # -40dB
            
            # 分割音频为小段，去除静音
            chunk_length = 100  # 100ms chunks
            chunks = []
            
            for i in range(0, len(audio), chunk_length):
                chunk = audio[i:i + chunk_length]
                if chunk.rms > silence_threshold:
                    chunks.append(chunk)
                elif len(chunks) > 0 and chunks[-1].rms > silence_threshold:
                    # 保留一些静音作为间隔
                    silence_chunk = AudioSegment.silent(duration=50)  # 50ms静音
                    chunks.append(silence_chunk)
            
            if chunks:
                audio = sum(chunks)
                print(f"去除静音后时长: {len(audio) / 1000:.2f} 秒")
        
        # 7. 设置输出格式参数
        export_params = {
            "format": "mp3",
            "bitrate": "128k",
            "parameters": ["-ar", str(target_sample_rate), "-ac", "1"]
        }
        
        # 导出优化后的音频
        print("导出优化后的音频...")
        audio.export(output_file, **export_params)
        
        # 显示优化后的信息
        optimized_audio = AudioSegment.from_file(output_file)
        print(f"\n优化后音频信息:")
        print(f"  时长: {len(optimized_audio) / 1000:.2f} 秒")
        print(f"  采样率: {optimized_audio.frame_rate} Hz")
        print(f"  声道数: {optimized_audio.channels}")
        print(f"  样本宽度: {optimized_audio.sample_width} 字节")
        print(f"  文件大小: {os.path.getsize(output_file) / 1024 / 1024:.2f} MB")
        
        print(f"\n音频优化完成！输出文件: {output_file}")
        return output_file
        
    except Exception as e:
        print(f"音频优化失败: {e}")
        return None

def analyze_audio_quality(file_path):
    """分析音频质量"""
    try:
        # 使用librosa分析
        y, sr = librosa.load(file_path, sr=None)
        
        # 计算基本统计信息
        rms_energy = np.sqrt(np.mean(y**2))
        max_amplitude = np.max(np.abs(y))
        zero_crossing_rate = np.mean(librosa.feature.zero_crossing_rate(y))
        
        # 计算静音比例
        silence_threshold = 0.01
        silence_frames = np.sum(np.abs(y) < silence_threshold)
        silence_percentage = (silence_frames / len(y)) * 100
        
        # 计算频谱质心
        spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
        
        print(f"\n音频质量分析:")
        print(f"  RMS能量: {rms_energy:.6f}")
        print(f"  最大振幅: {max_amplitude:.6f}")
        print(f"  过零率: {zero_crossing_rate:.6f}")
        print(f"  静音比例: {silence_percentage:.2f}%")
        print(f"  频谱质心: {spectral_centroid:.2f} Hz")
        
        return {
            'rms_energy': rms_energy,
            'max_amplitude': max_amplitude,
            'zero_crossing_rate': zero_crossing_rate,
            'silence_percentage': silence_percentage,
            'spectral_centroid': spectral_centroid
        }
        
    except Exception as e:
        print(f"音频质量分析失败: {e}")
        return None

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='音频优化工具 - 提高ASR识别率')
    parser.add_argument('input_file', help='输入音频文件路径')
    parser.add_argument('-o', '--output', help='输出音频文件路径')
    parser.add_argument('-sr', '--sample-rate', type=int, default=24000, help='目标采样率 (默认: 24000)')
    parser.add_argument('--no-volume', action='store_true', help='不增强音量')
    parser.add_argument('--no-silence', action='store_true', help='不去除静音')
    parser.add_argument('--no-normalize', action='store_true', help='不标准化音频')
    parser.add_argument('--no-compress', action='store_true', help='不压缩动态范围')
    parser.add_argument('--analyze-only', action='store_true', help='仅分析音频质量，不进行优化')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_file):
        print(f"错误: 输入文件不存在: {args.input_file}")
        return 1
    
    # 分析音频质量
    print("=" * 50)
    print("分析原始音频质量...")
    analyze_audio_quality(args.input_file)
    
    if args.analyze_only:
        return 0
    
    # 优化音频
    print("=" * 50)
    output_file = optimize_audio_for_asr(
        input_file=args.input_file,
        output_file=args.output,
        target_sample_rate=args.sample_rate,
        enhance_volume=not args.no_volume,
        remove_silence=not args.no_silence,
        normalize_audio=not args.no_normalize,
        compress_audio=not args.no_compress
    )
    
    if output_file:
        # 分析优化后的音频质量
        print("=" * 50)
        print("分析优化后音频质量...")
        analyze_audio_quality(output_file)
        print("=" * 50)
        print("优化建议:")
        print("1. 将优化后的音频文件上传到会议纪要系统")
        print("2. 如果仍然无法识别，尝试调整采样率参数")
        print("3. 检查音频内容是否清晰，语音是否连续")
        return 0
    else:
        return 1

if __name__ == "__main__":
    # 如果没有命令行参数，使用默认文件进行测试
    if len(sys.argv) == 1:
        # 测试模式：优化my_voice.mp3
        input_file = "../my_voice.mp3"
        if os.path.exists(input_file):
            print("测试模式：优化 my_voice.mp3")
            analyze_audio_quality(input_file)
            output_file = optimize_audio_for_asr(input_file)
            if output_file:
                analyze_audio_quality(output_file)
        else:
            print(f"测试文件不存在: {input_file}")
            print("使用方法: python audio_optimizer.py <输入文件> [-o 输出文件]")
    else:
        sys.exit(main())