#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成测试音频文件的脚本
"""

import numpy as np
from pydub import AudioSegment
from pydub.generators import Sine
import os

def create_test_audio():
    """创建一个测试音频文件"""
    try:
        # 生成一个10秒的测试音频（440Hz正弦波）
        duration = 10000  # 10秒，以毫秒为单位
        frequency = 440   # A4音符
        
        # 生成正弦波
        sine_wave = Sine(frequency).to_audio_segment(duration=duration)
        
        # 设置音量（降低音量避免过响）
        sine_wave = sine_wave - 20  # 降低20dB
        
        # 保存为MP3文件
        output_path = os.path.join(os.path.dirname(__file__), 'test_audio.mp3')
        sine_wave.export(output_path, format="mp3", bitrate="128k")
        
        print(f"测试音频文件已创建: {output_path}")
        print(f"文件大小: {os.path.getsize(output_path)} 字节")
        print(f"时长: {len(sine_wave) / 1000} 秒")
        
        return output_path
        
    except Exception as e:
        print(f"创建测试音频文件失败: {e}")
        return None

if __name__ == "__main__":
    create_test_audio()