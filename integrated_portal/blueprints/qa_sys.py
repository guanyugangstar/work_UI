# -*- coding: utf-8 -*-
from flask import Blueprint, render_template, send_from_directory
import os

# 使用Blueprint整合"业务查询系统"到统一门户
qa_sys_bp = Blueprint(
    'qa_sys', __name__,
    template_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../templates')),
    static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../../QA-sys')),
    static_url_path='/qa_sys/static'
)

@qa_sys_bp.route('/')
def index():
    """业务查询系统主页面"""
    return render_template('qa_sys.html')

@qa_sys_bp.route('/static/<path:filename>')
def static_files(filename):
    """提供静态文件服务"""
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../QA-sys'))
    return send_from_directory(static_dir, filename)
