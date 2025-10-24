#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频文件分析工具
用于分析MP3文件的技术参数，帮助诊断ASR识别问题
"""

import os
import sys
import librosa
import numpy as np
from pydub import AudioSegment
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # 使用非交互式后端

def analyze_audio_file(file_path):
    """分析音频文件的技术参数和特征"""
    print(f"\n=== 分析文件: {os.path.basename(file_path)} ===")
    
    if not os.path.exists(file_path):
        print(f"错误: 文件不存在 - {file_path}")
        return None
    
    try:
        # 使用pydub获取基本信息
        audio = AudioSegment.from_mp3(file_path)
        
        print(f"文件大小: {os.path.getsize(file_path) / (1024*1024):.2f} MB")
        print(f"时长: {len(audio) / 1000:.2f} 秒")
        print(f"采样率: {audio.frame_rate} Hz")
        print(f"声道数: {audio.channels}")
        print(f"样本宽度: {audio.sample_width} 字节")
        print(f"比特率: {audio.frame_rate * audio.channels * audio.sample_width * 8} bps")
        
        # 使用librosa进行更详细的分析
        y, sr = librosa.load(file_path, sr=None)
        
        print(f"\n--- 音频质量分析 ---")
        print(f"实际采样率: {sr} Hz")
        print(f"音频长度: {len(y)} 样本")
        print(f"音频时长: {len(y) / sr:.2f} 秒")
        
        # 计算音频统计信息
        rms_energy = np.sqrt(np.mean(y**2))
        max_amplitude = np.max(np.abs(y))
        zero_crossing_rate = np.mean(librosa.feature.zero_crossing_rate(y))
        
        print(f"RMS能量: {rms_energy:.6f}")
        print(f"最大振幅: {max_amplitude:.6f}")
        print(f"过零率: {zero_crossing_rate:.6f}")
        
        # 检测静音段
        silence_threshold = 0.01
        silence_samples = np.sum(np.abs(y) < silence_threshold)
        silence_percentage = (silence_samples / len(y)) * 100
        print(f"静音比例: {silence_percentage:.2f}%")
        
        # 频谱分析
        stft = librosa.stft(y)
        magnitude = np.abs(stft)
        
        # 计算频谱质心
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)
        mean_spectral_centroid = np.mean(spectral_centroids)
        print(f"频谱质心: {mean_spectral_centroid:.2f} Hz")
        
        # 计算MFCC特征
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        print(f"MFCC特征形状: {mfccs.shape}")
        print(f"MFCC均值: {np.mean(mfccs, axis=1)[:5]}")  # 显示前5个系数的均值
        
        # 检测语音活动
        # 使用简单的能量阈值检测
        frame_length = 2048
        hop_length = 512
        frames = librosa.util.frame(y, frame_length=frame_length, hop_length=hop_length)
        frame_energy = np.sum(frames**2, axis=0)
        energy_threshold = np.percentile(frame_energy, 20)  # 使用20%分位数作为阈值
        
        voice_frames = np.sum(frame_energy > energy_threshold)
        voice_percentage = (voice_frames / len(frame_energy)) * 100
        print(f"语音活动比例: {voice_percentage:.2f}%")
        
        # 频率范围分析
        freqs = librosa.fft_frequencies(sr=sr)
        magnitude_mean = np.mean(magnitude, axis=1)
        
        # 找到主要能量分布的频率范围
        energy_cumsum = np.cumsum(magnitude_mean)
        energy_total = energy_cumsum[-1]
        
        # 找到包含90%能量的频率范围
        freq_90_idx = np.where(energy_cumsum >= 0.9 * energy_total)[0][0]
        freq_90 = freqs[freq_90_idx]
        print(f"90%能量频率上限: {freq_90:.2f} Hz")
        
        # 检查是否有高频内容
        high_freq_energy = np.sum(magnitude_mean[freqs > 4000])
        total_energy = np.sum(magnitude_mean)
        high_freq_ratio = high_freq_energy / total_energy
        print(f"高频能量比例 (>4kHz): {high_freq_ratio:.4f}")
        
        return {
            'file_path': file_path,
            'duration': len(audio) / 1000,
            'sample_rate': sr,
            'channels': audio.channels,
            'rms_energy': rms_energy,
            'max_amplitude': max_amplitude,
            'silence_percentage': silence_percentage,
            'voice_percentage': voice_percentage,
            'spectral_centroid': mean_spectral_centroid,
            'high_freq_ratio': high_freq_ratio,
            'zero_crossing_rate': zero_crossing_rate
        }
        
    except Exception as e:
        print(f"分析文件时出错: {e}")
        return None

def compare_audio_files(file1_path, file2_path):
    """比较两个音频文件的差异"""
    print("\n" + "="*60)
    print("音频文件对比分析")
    print("="*60)
    
    result1 = analyze_audio_file(file1_path)
    result2 = analyze_audio_file(file2_path)
    
    if result1 and result2:
        print(f"\n=== 对比总结 ===")
        print(f"文件1: {os.path.basename(file1_path)}")
        print(f"文件2: {os.path.basename(file2_path)}")
        print("-" * 40)
        
        # 比较关键参数
        params = [
            ('采样率', 'sample_rate', 'Hz'),
            ('RMS能量', 'rms_energy', ''),
            ('静音比例', 'silence_percentage', '%'),
            ('语音活动比例', 'voice_percentage', '%'),
            ('频谱质心', 'spectral_centroid', 'Hz'),
            ('高频能量比例', 'high_freq_ratio', ''),
            ('过零率', 'zero_crossing_rate', '')
        ]
        
        for param_name, param_key, unit in params:
            val1 = result1[param_key]
            val2 = result2[param_key]
            diff = abs(val1 - val2)
            diff_percent = (diff / max(val1, val2)) * 100 if max(val1, val2) > 0 else 0
            
            print(f"{param_name}:")
            print(f"  文件1: {val1:.4f} {unit}")
            print(f"  文件2: {val2:.4f} {unit}")
            print(f"  差异: {diff:.4f} ({diff_percent:.1f}%)")
            print()
    
    return result1, result2

def generate_recommendations(result1, result2, file1_name, file2_name):
    """基于分析结果生成优化建议"""
    print(f"\n=== ASR识别优化建议 ===")
    
    if not result1 or not result2:
        print("无法生成建议：分析数据不完整")
        return
    
    # 确定哪个文件可以被识别，哪个不能
    working_file = file1_name if "广州珠海" in file1_name else file2_name
    problem_file = file2_name if "广州珠海" in file1_name else file1_name
    working_result = result1 if "广州珠海" in file1_name else result2
    problem_result = result2 if "广州珠海" in file1_name else result1
    
    print(f"可识别文件: {working_file}")
    print(f"问题文件: {problem_file}")
    print("-" * 40)
    
    recommendations = []
    
    # 检查采样率
    if problem_result['sample_rate'] != working_result['sample_rate']:
        recommendations.append(f"采样率不匹配：将采样率从 {problem_result['sample_rate']} Hz 调整为 {working_result['sample_rate']} Hz")
    
    # 检查音频能量
    if problem_result['rms_energy'] < working_result['rms_energy'] * 0.5:
        recommendations.append("音频能量过低：需要增强音频音量")
    
    # 检查静音比例
    if problem_result['silence_percentage'] > working_result['silence_percentage'] * 2:
        recommendations.append("静音过多：考虑去除长时间静音段")
    
    # 检查语音活动
    if problem_result['voice_percentage'] < working_result['voice_percentage'] * 0.7:
        recommendations.append("语音活动不足：可能需要降噪或增强语音信号")
    
    # 检查频谱特征
    if problem_result['spectral_centroid'] < 1000:
        recommendations.append("频谱质心过低：音频可能缺乏高频成分，考虑音频增强")
    
    # 检查高频内容
    if problem_result['high_freq_ratio'] < working_result['high_freq_ratio'] * 0.5:
        recommendations.append("高频能量不足：可能影响语音清晰度")
    
    if recommendations:
        print("建议的优化措施：")
        for i, rec in enumerate(recommendations, 1):
            print(f"{i}. {rec}")
    else:
        print("音频参数看起来正常，可能是其他因素导致ASR识别失败")
    
    print(f"\n=== 通用ASR优化建议 ===")
    print("1. 确保采样率为16kHz或44.1kHz")
    print("2. 使用单声道音频")
    print("3. 音频比特率建议64kbps以上")
    print("4. 去除背景噪音和长时间静音")
    print("5. 确保音频音量适中，避免过载或过小")
    print("6. 检查音频编码格式兼容性")

if __name__ == "__main__":
    # 分析两个MP3文件
    file1 = r"d:\code\work_UI\广州珠海政务调研播客_01.mp3"
    file2 = r"d:\code\work_UI\my_voice.mp3"
    
    result1, result2 = compare_audio_files(file1, file2)
    generate_recommendations(result1, result2, os.path.basename(file1), os.path.basename(file2))