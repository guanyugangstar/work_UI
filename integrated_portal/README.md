# 统一门户系统（蓝图整合版）

一个集成五个独立子系统的Web门户应用，提供统一的访问入口和标签页管理功能。

## 🌟 功能特性

- **统一入口**: 通过单一门户访问所有子系统
- **标签页管理**: 支持多标签页切换，类似浏览器体验
- **统一蓝图**: 所有五个子系统均已整合为Flask蓝图，统一使用9000端口管理
- **健康监控**: 实时监控各子系统运行状态，支持详细的组件健康检查
- **响应式设计**: 支持桌面和移动设备访问
- **一键启动**: 启动门户即可访问所有子系统

## 📋 系统架构

```
统一门户系统 (端口: 9000)
├── 智能写作系统 (/writing, Flask蓝图)
├── 业务查询系统 (/qa_sys, Flask蓝图)
├── 数据处理系统 (/case2pg, Flask蓝图)
├── 文件审查系统 (/censor, Flask蓝图)
└── 会议纪要生成系统 (/meeting_minutes, Flask蓝图)
```

## 🚀 快速开始

### 环境要求

- Python 3.7+
- 所有子系统的依赖已安装

### 安装步骤

1. **克隆或下载项目**
   - 所有子系统已整合为Flask蓝图，无需单独启动各自的端口

2. **安装Python依赖**
   ```bash
   cd integrated_portal
   pip install -r requirements.txt
   ```

3. **启动门户**
   - 启动统一门户即可访问所有四个子系统：
   ```bash
   cd integrated_portal
   python app.py
   ```

4. **访问门户**
   
   打开浏览器访问: http://localhost:9000

## 📁 项目结构

```
integrated_portal/
├── app.py                 # 主应用入口
├── start.bat            # Windows 启动脚本
├── requirements.txt      # Python依赖
├── README.md            # 项目说明
├── config/              # 配置模块
│   ├── __init__.py
│   └── settings.py      # 系统配置
├── services/            # 服务模块
│   ├── __init__.py
│   ├── service_manager.py # 服务管理器
│   └── health_check.py  # 健康检查服务
├── utils/               # 工具模块
│   ├── __init__.py
│   └── logger.py        # 日志工具
├── blueprints/          # 子系统蓝图
│   ├── writing.py       # 智能写作系统蓝图
│   ├── qa_sys.py        # 业务查询系统蓝图
│   ├── case2pg.py       # 数据处理系统蓝图
│   ├── censor.py        # 文件审查系统蓝图
│   └── meeting_minutes.py # 会议纪要生成系统蓝图
├── templates/           # HTML 模板
│   ├── base.html        # 基础模板
│   ├── index.html       # 主页模板
│   ├── qa_sys.html      # 业务查询系统模板
│   ├── meeting_minutes.html # 会议纪要生成系统模板
│   └── error.html       # 错误页面模板
└── static/              # 静态资源
    ├── css/
    │   ├── main.css     # 主样式
    │   └── tabs.css     # 标签页样式
    ├── js/
    │   ├── main.js      # 主脚本
    │   └── tab-manager.js # 标签页管理器
    └── favicon.ico      # 网站图标
```

## ⚙️ 配置说明

### 系统配置 (config/settings.py)

```python
# 门户服务配置
HOST = '0.0.0.0'
PORT = 9000
DEBUG = True

# 子系统配置（所有系统均为蓝图）
SUBSYSTEMS = {
    'writing': {
        'name': '智能写作系统',
        'url': 'http://localhost:9000/writing',
        'path': '/writing',
        # ...
    },
    'qa_sys': {
        'name': '业务查询系统',
        'url': 'http://localhost:9000/qa_sys',
        'path': '/qa_sys',
        # ...
    },
    'case2pg': {
        'name': '数据处理系统',
        'url': 'http://localhost:9000/case2pg',
        'path': '/case2pg',
        # ...
    },
    'censor': {
        'name': '文件审查系统',
        'url': 'http://localhost:9000/censor',
        'path': '/censor',
        # ...
    },
    'meeting_minutes': {
        'name': '会议纪要生成系统',
        'url': 'http://localhost:9000/meeting_minutes',
        'path': '/meeting_minutes',
        # ...
    }
}
```

### 端口与路由配置

| 系统 | 路径 | 说明 |
|------|------|------|
| 统一门户 | / | 主入口 (端口 9000) |
| 智能写作系统 | /writing | Flask 蓝图 |
| 业务查询系统 | /qa_sys | Flask 蓝图 |
| 数据处理系统 | /case2pg | Flask 蓝图 |
| 文件审查系统 | /censor | Flask 蓝图 |
| 会议纪要生成系统 | /meeting_minutes | Flask 蓝图 |

## 🔧 使用说明

### 会议纪要生成系统功能

**会议纪要生成系统** 是统一门户的核心功能之一，提供智能化的会议记录处理和纪要生成服务：

#### 主要功能
- **音频上传**: 支持多种音频格式文件上传
- **智能转录**: 基于AI技术的语音转文字功能
- **音频拼接**: 支持多个音频文件的智能拼接处理
- **会议纪要生成**: 自动分析会议内容，生成结构化纪要
- **多人数识别**: 智能识别会议参与人数
- **主题提取**: 自动提取会议主要议题和关键内容

#### 使用流程
1. **上传音频**: 在音频上传区域选择或拖拽音频文件
2. **音频处理**: 系统自动进行音频优化和预处理
3. **音频拼接** (可选): 如需合并多个音频文件，使用音频拼接功能
4. **生成纪要**: 点击"生成会议纪要"按钮，系统将自动：
   - 转录音频内容
   - 分析会议结构
   - 提取关键信息
   - 生成格式化纪要
5. **结果导出**: 支持多种格式的纪要导出

#### 技术特点
- **高精度转录**: 采用先进的语音识别技术
- **智能分析**: AI驱动的内容理解和结构化处理
- **实时处理**: 支持大文件的流式处理
- **多格式支持**: 兼容常见音频格式

### 基本操作

1. **访问子系统**: 点击首页的系统卡片
2. **标签页管理**: 
   - 点击标签页切换系统
   - 右键标签页显示上下文菜单
   - 中键点击关闭标签页
3. **系统状态**: 点击右上角状态按钮查看健康状态

### 键盘快捷键

- `Ctrl + W`: 关闭当前标签页
- `Ctrl + R`: 刷新当前标签页
- `Ctrl + Tab`: 切换到下一个标签页

### API接口

- `GET /health`: 获取所有系统健康状态
- `GET /health/<service>`: 获取指定系统状态
- `GET /api/systems`: 获取系统配置信息
- `GET /writing/health`: 智能文件撰写系统健康检查
- `GET /qa_sys/health`: 业务查询系统健康检查
- `GET /case2pg/api/monitoring/health`: 数据处理系统健康检查
- `GET /censor/health`: 文件审查系统健康检查
- `GET /meeting_minutes/health`: 会议纪要生成系统健康检查

## 🛠️ 开发指南

### 添加新的子系统

1. **创建蓝图文件** (blueprints/new_system.py):
   ```python
   from flask import Blueprint, render_template, jsonify
   
   new_system_bp = Blueprint('new_system', __name__, url_prefix='/new_system')
   
   @new_system_bp.route('/')
   def index():
       return render_template('new_system.html')
   
   @new_system_bp.route('/health')
   def health():
       return jsonify({'status': 'healthy', 'service': 'new_system'})
   ```

2. **注册蓝图** (app.py):
   ```python
   from blueprints.new_system import new_system_bp
   app.register_blueprint(new_system_bp)
   ```

3. **更新配置** (config/settings.py):
   ```python
   SYSTEMS['new_system'] = {
       'name': '新系统',
       'description': '系统描述',
       'url': 'http://localhost:9000/new_system',
       'path': '/new_system',
       'icon': 'fas fa-cog',
       'color': '#10b981'
   }
   ```

### 健康检查机制

每个子系统都实现了专门的健康检查路由：
- 返回JSON格式的健康状态
- 支持详细的组件状态检查
- 统一的状态码：`healthy`、`degraded`、`unhealthy`

### 自定义样式

修改 `static/css/main.css` 和 `static/css/tabs.css` 来自定义界面样式。

### 日志配置

日志文件位置: `logs/app.log`

可以通过修改 `utils/logger.py` 来调整日志级别和格式。

## 🐛 故障排除

### 常见问题

1. **蓝图注册失败**
   - 检查蓝图文件是否正确导入
   - 确认蓝图名称没有冲突

2. **健康检查失败**
   - 检查各子系统的健康检查路由是否正常
   - 查看日志文件获取详细错误信息

3. **静态资源加载失败**
   - 确认静态文件路径正确
   - 检查文件权限设置

### 日志查看

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log
```

## 📝 更新日志

### v2.1.0 (2024-12-XX)
- 新增会议纪要生成系统
- 支持音频文件上传和智能转录
- 实现音频拼接和处理功能
- 集成AI驱动的会议纪要自动生成
- 优化用户界面和交互体验

### v2.0.0 (2024-10-XX)
- 完成所有四个子系统的蓝图整合
- 统一使用9000端口管理所有服务
- 实现详细的健康检查机制
- 优化服务管理和监控功能

### v1.0.0 (2024-01-XX)
- 初始版本发布
- 支持四个子系统集成
- 实现标签页管理功能
- 添加健康监控和反向代理

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如果您遇到问题或有建议，请：

1. 查看本文档的故障排除部分
2. 检查日志文件获取详细信息
3. 提交 Issue 描述问题

---

**享受使用统一门户系统！** 🎉