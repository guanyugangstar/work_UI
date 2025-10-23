# -*- coding: utf-8 -*-
"""
数据处理系统蓝图
将case2pg系统集成到统一门户
"""
from flask import Blueprint, render_template, render_template_string, request, jsonify, Response
import os
import sys

# 添加case2pg模块路径
case2pg_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../case2pg'))
if case2pg_path not in sys.path:
    sys.path.insert(0, case2pg_path)

# 导入case2pg的功能模块并初始化数据库连接
try:
    from app.db.dao import query_table, check_table_exists, delete_record, get_table_primary_key, execute_query
    from app.services import guess_type, upload_file, workflow_response, forward_and_collect
    from app.config import API_URL, API_KEY, USER_ID
    from app.exceptions import DatabaseError, WorkflowError, FileUploadError, ExternalAPIError
    from app.utils.response import success_response, error_response
    from app.utils.logger import get_logger, log_api_call, monitor_performance
    from app.utils.monitoring import record_database_metric, get_metrics, get_health_status, check_alerts, record_api_call_metric
    from app.db.connection import db_manager
    from app.config.base import Config
    
    # 初始化数据库连接池
    class MockApp:
        def __init__(self):
            self.config = {}
            self.logger = None
            
        def get(self, key, default=None):
            return self.config.get(key, default)
            
    mock_app = MockApp()
    # 设置数据库配置
    mock_app.config['DATABASE_URL'] = Config.DATABASE_URL
    mock_app.config['DB_POOL_SIZE'] = 10
    mock_app.config['DB_MAX_OVERFLOW'] = 20
    mock_app.config['DB_POOL_TIMEOUT'] = 30
    
    # 初始化数据库管理器
    try:
        db_manager.init_app(mock_app)
        print("[INFO] case2pg数据库连接池初始化成功")
    except Exception as db_init_error:
        print(f"[WARNING] case2pg数据库连接池初始化失败: {db_init_error}")
        
except ImportError as e:
    print(f"Warning: 无法导入case2pg模块: {e}")
    # 创建空的占位符函数，避免运行时错误
    def query_table(*args, **kwargs): return []
    def check_table_exists(*args, **kwargs): return False
    def delete_record(*args, **kwargs): return False
    def get_table_primary_key(*args, **kwargs): return None
    def execute_query(*args, **kwargs): return None
    def guess_type(*args, **kwargs): return None
    def upload_file(*args, **kwargs): return False, "模块未加载"
    def workflow_response(*args, **kwargs): return None
    def forward_and_collect(*args, **kwargs): return None
    def success_response(*args, **kwargs): return jsonify({"error": "模块未加载"})
    def error_response(*args, **kwargs): return jsonify({"error": "模块未加载"})
    def get_logger(*args, **kwargs): return None
    def log_api_call(*args, **kwargs): return lambda f: f
    def monitor_performance(*args, **kwargs): return lambda f: f
    def record_database_metric(*args, **kwargs): pass
    def get_metrics(*args, **kwargs): return {}
    def get_health_status(*args, **kwargs): return {"status": "unknown"}
    def check_alerts(*args, **kwargs): return []
    def record_api_call_metric(*args, **kwargs): pass
    API_URL = ""
    API_KEY = ""
    USER_ID = ""
    class DatabaseError(Exception): pass
    class WorkflowError(Exception): pass
    class FileUploadError(Exception): pass
    class ExternalAPIError(Exception): pass

# 使用Blueprint整合"数据处理系统"到统一门户
case2pg_bp = Blueprint(
    'case2pg', __name__,
    template_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../../case2pg/app/templates')),
    static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../../case2pg/static')),
    static_url_path='/case2pg/static'
)

# 全局变量用于存储最近一次工作流输出
last_workflow_outputs = []

@case2pg_bp.route('/', methods=['GET'])
def index():
    """主页路由"""
    # 避免与门户 index.html 模板冲突，直接读取原子系统模板内容渲染
    tpl_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../case2pg/app/templates/index.html'))
    try:
        with open(tpl_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return render_template_string(content)
    except FileNotFoundError:
        return "模板文件未找到", 404

@case2pg_bp.route('/upload', methods=['POST'])
def upload():
    """文件上传和处理路由"""
    global last_workflow_outputs
    try:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.info('开始文件上传和处理')
        
        print("=" * 50)
        print("[DEBUG] 收到文件上传请求")
        print(f"[DEBUG] 开始处理上传请求")
        print(f"[DEBUG] API_URL: {API_URL}")
        print(f"[DEBUG] API_KEY: {API_KEY[:10]}..." if API_KEY else "[DEBUG] API_KEY: None")
        print(f"[DEBUG] USER_ID: {USER_ID}")
        print("=" * 50)
        
        files = request.files.getlist("input_data")
        print(f"[DEBUG] 接收到 {len(files)} 个文件")
        if logger:
            logger.info(f'接收到 {len(files)} 个文件')
        
        upload_file_ids = []
        file_types = []
        
        # 处理每个上传的文件
        for i, f in enumerate(files):
            print(f"[DEBUG] 处理文件 {i+1}: {f.filename}")
            if logger:
                logger.info(f'处理文件 {i+1}: {f.filename}')
            
            # 上传到 Dify API
            success, result = upload_file(f, API_URL, API_KEY, USER_ID)
            print(f"[DEBUG] 文件上传结果: success={success}, result={result}")
            
            if not success:
                print(f"[ERROR] 文件上传失败: {result}")
                raise FileUploadError(f"文件 {f.filename} 上传失败", detail=result)
                
            file_info = result
            upload_file_ids.append(file_info["id"])
            file_types.append(guess_type(f))
            if logger:
                logger.info(f'文件上传成功，文件ID: {file_info["id"]}')
        
        # 准备工作流请求数据
        input_data = [
            {
                "transfer_method": "local_file",
                "upload_file_id": fid,
                "type": ftype
            }
            for fid, ftype in zip(upload_file_ids, file_types)
        ]
        
        payload = {
            "inputs": {"input_data": input_data},
            "response_mode": "streaming",
            "user": USER_ID
        }
        
        # SSE流式转发
        def generate():
            global last_workflow_outputs
            last_workflow_outputs = []  # 每次新上传清空
            resp2 = workflow_response(API_URL, API_KEY, payload)
            try:
                for chunk in forward_and_collect(resp2, last_workflow_outputs):
                    yield chunk
                if logger:
                    logger.info('工作流执行完成')
                # 记录API调用指标
                record_api_call_metric('dify_upload_and_workflow', 0, True)
            finally:
                try:
                    resp2.close()
                except Exception:
                    pass

        return Response(generate(), mimetype='text/event-stream')
        
    except (FileUploadError, WorkflowError, ExternalAPIError) as e:
        # 记录失败指标
        record_api_call_metric('dify_upload_and_workflow', 0, False)
        print(f"[ERROR] 业务异常: {e}")
        return error_response(str(e), 400)
    except Exception as e:
        # 记录失败指标
        record_api_call_metric('dify_upload_and_workflow', 0, False)
        print(f"[ERROR] 系统异常: {e}")
        if logger:
            logger.error(f'文件上传处理异常: {str(e)}', exc_info=True)
        raise WorkflowError(f"文件处理过程中发生未知错误: {str(e)}")

@case2pg_bp.route("/get_last_workflow_outputs", methods=["GET"])
def get_last_workflow_outputs():
    """获取最近一次工作流的输出结果"""
    global last_workflow_outputs
    try:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.info('获取最近一次工作流输出')
        
        print(f"[DEBUG] 获取最近一次工作流输出，当前数据长度: {len(last_workflow_outputs) if last_workflow_outputs else 0}")
        
        if not last_workflow_outputs:
            return jsonify({
                "status": "no_data",
                "message": "暂无工作流输出数据",
                "data": []
            })
        
        return jsonify({
            "status": "success",
            "message": "获取工作流输出成功",
            "data": last_workflow_outputs
        })
        
    except Exception as e:
        print(f"[ERROR] 获取工作流输出异常: {e}")
        if logger:
            logger.error(f'获取工作流输出异常: {str(e)}', exc_info=True)
        return error_response(f"获取工作流输出失败: {str(e)}", 500)


@case2pg_bp.route("/get_available_tables", methods=["GET"])
def get_available_tables():
    """获取可用的数据库表格列表"""
    try:
        # 定义可用的表格及其信息
        available_tables = [
            {
                'table_name': 'case_summary',
                'display_name': '行政复议案件汇总',
                'class_name': '复议',
                'primary_key': '案号'
            },
            {
                'table_name': 'reconsideration_summary', 
                'display_name': '行政复议案件汇总',
                'class_name': '复议',
                'primary_key': '案号'
            },
            {
                'table_name': 'contract_summary',
                'display_name': '合同案件汇总', 
                'class_name': '合同',
                'primary_key': '合同号'
            }
        ]
        
        # 检查表是否实际存在，并获取记录数
        result_tables = []
        for table_info in available_tables:
            table_name = table_info['table_name']
            if check_table_exists(table_name):
                try:
                    # 获取记录数
                    rows = query_table(table_name, limit=1)
                    count_query = f"SELECT COUNT(*) as count FROM {table_name}"
                    count_result = execute_query(count_query, fetch_all=False)
                    record_count = count_result['count'] if count_result else 0
                    
                    table_info['exists'] = True
                    table_info['record_count'] = record_count
                except Exception as e:
                    logger = get_logger(__name__) if get_logger else None
                    if logger:
                        logger.warning(f'获取表 {table_name} 记录数失败: {e}')
                    table_info['exists'] = True
                    table_info['record_count'] = 0
            else:
                table_info['exists'] = False
                table_info['record_count'] = 0
            
            result_tables.append(table_info)
        
        return success_response(result_tables)
        
    except Exception as e:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.error(f'获取可用表格列表失败: {e}')
        return error_response(f'获取表格列表失败: {str(e)}', 500)

@case2pg_bp.route("/get_table_data", methods=["GET"])
def get_table_data():
    """获取数据库表格数据"""
    try:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.info('开始获取数据库表格数据')
        
        # 获取请求参数
        table_name = request.args.get('table_name')
        check_workflow = request.args.get('check_workflow')
        
        # 尝试从工作流输出获取数据
        workflow_outputs = get_last_workflow_outputs()
        
        if workflow_outputs and not table_name:
            # 如果有工作流输出且没有指定表格，根据问题分类器节点确定表格
            if logger:
                logger.info('检测到工作流输出，开始解析问题分类器节点')
            
            # 遍历所有json体，查找event为node_finished且data.title为"问题分类器"的节点
            classifier_node = None
            for obj in workflow_outputs:
                if isinstance(obj, dict) and obj.get('event') == 'node_finished':
                    data = obj.get('data', {})
                    if data.get('title') == '问题分类器':
                        classifier_node = data
                        break
            
            if not classifier_node:
                if logger:
                    logger.warning('未找到"问题分类器"节点')
                if check_workflow:
                    return success_response({'from_workflow': False})
                return error_response('未找到"问题分类器"节点', 400)
            
            outputs = classifier_node.get('outputs')
            class_name = None
            if outputs and isinstance(outputs, dict):
                class_name = outputs.get('class_name')
            
            if not class_name:
                if logger:
                    logger.warning(f'"问题分类器"节点缺少class_name，outputs: {outputs}')
                if check_workflow:
                    return success_response({'from_workflow': False})
                return error_response('"问题分类器"节点缺少class_name', 400)
            
            # 根据class_name确定表格
            table_map = {
                '合同': 'contract_summary',
                '复议': 'reconsideration_summary',
                '诉讼': 'case_summary'
            }
            
            workflow_table_name = table_map.get(class_name)
            if not workflow_table_name:
                if logger:
                    logger.warning(f'class_name为{class_name}，无对应表格')
                if check_workflow:
                    return success_response({'from_workflow': False})
                return error_response(f'class_name为{class_name}，无对应表格', 400)
            
            if logger:
                logger.info(f'工作流确定表格: {class_name} -> {workflow_table_name}')
            
            # 如果是检查工作流状态的请求，返回工作流信息
            if check_workflow:
                return success_response({
                    'from_workflow': True,
                    'class_name': class_name,
                    'table_name': workflow_table_name
                })
            
            # 设置table_name为工作流确定的表格
            table_name = workflow_table_name
        
        # 如果是检查工作流状态的请求且没有工作流输出，返回空结果
        if check_workflow and not workflow_outputs:
            if logger:
                logger.info('检查工作流状态：无工作流输出')
            return success_response({'from_workflow': False})
        
        # 如果没有指定表格名称，返回错误
        if not table_name:
            if logger:
                logger.warning('未指定表格名称')
            return error_response('请选择要查看的表格', 400)
        
        # 表格映射和类型映射
        table_mapping = {
            'case_summary': '复议',
            'reconsideration_summary': '复议', 
            'contract_summary': '合同'
        }
        
        # 主键映射
        primary_key_mapping = {
            'case_summary': '案号',
            'reconsideration_summary': '案号',
            'contract_summary': '合同号'
        }
        
        # 检查表是否存在
        if not check_table_exists(table_name):
            if logger:
                logger.warning(f'表 {table_name} 不存在')
            return success_response({
                'class_name': table_mapping.get(table_name, '未知'),
                'table_name': table_name,
                'primary_key': primary_key_mapping.get(table_name, 'id'),
                'columns': [],
                'rows': [],
                'total_count': 0
            })
        
        # 查询表格数据
        rows = query_table(table_name, limit=1000)
        
        # 获取列名（从第一行数据推断）
        columns = list(rows[0].keys()) if rows else []
        
        # 转换为列表格式
        rows_list = []
        for row in rows:
            rows_list.append(list(row.values()))
        
        if logger:
            logger.info(f'数据库查询完成，返回 {len(rows_list)} 条记录')
        
        return success_response({
            'class_name': table_mapping.get(table_name, '未知'),
            'table_name': table_name,
            'primary_key': primary_key_mapping.get(table_name, 'id'),
            'columns': columns,
            'rows': rows_list,
            'total_count': len(rows_list)
        })
        
    except (WorkflowError, DatabaseError):
        # 这些异常会被全局错误处理器处理
        raise
    except Exception as e:
        print(f"[ERROR] 获取表格数据异常: {str(e)}")
        raise DatabaseError(f'获取表格数据时发生未知错误: {str(e)}')

@case2pg_bp.route("/delete_record", methods=["POST"])
def delete_record_api():
    """删除数据库记录"""
    try:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.info('开始删除数据库记录')
        
        # 获取请求参数
        data = request.get_json()
        if not data:
            return error_response('请求参数不能为空', 400)
        
        table_name = data.get('table_name')
        record_id = data.get('record_id')
        
        if not table_name:
            return error_response('表名不能为空', 400)
        
        if not record_id:
            return error_response('记录ID不能为空', 400)
        
        if logger:
            logger.info(f'删除记录 - 表: {table_name}, ID: {record_id}')
        
        # 执行删除操作
        import time
        start_time = time.time()
        try:
            deleted_count = delete_record(table_name, record_id)
            
            delete_duration = time.time() - start_time
            record_database_metric(delete_duration)
            if logger:
                logger.info(f'删除操作完成，耗时: {delete_duration:.3f}s，删除 {deleted_count} 条记录')
            
        except DatabaseError as e:
            delete_duration = time.time() - start_time
            record_database_metric(delete_duration)
            if logger:
                logger.error(f'删除操作失败: {str(e)}')
            return error_response(str(e), 500)
        
        return success_response({
            'message': '删除成功',
            'deleted_count': deleted_count,
            'table_name': table_name,
            'record_id': record_id
        })
        
    except DatabaseError:
        # 这些异常会被全局错误处理器处理
        raise
    except Exception as e:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.error(f'删除记录异常: {str(e)}')
        return error_response(f'删除记录失败: {str(e)}', 500)

# 监控相关路由
@case2pg_bp.route('/api/monitoring/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    try:
        health_status = get_health_status()
        
        if health_status['status'] == 'healthy':
            return success_response(health_status, '系统健康')
        else:
            return jsonify(health_status), 503  # Service Unavailable
            
    except Exception as e:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.error(f'健康检查失败: {str(e)}', exc_info=True)
        return error_response(f'健康检查失败: {str(e)}', 500)

# 获取logger实例
logger = get_logger(__name__)

@case2pg_bp.route('/api/monitoring/metrics', methods=['GET'])
def get_system_metrics():
    """获取系统指标"""
    try:
        metrics = get_metrics()
        return success_response(metrics, '获取指标成功')
        
    except Exception as e:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.error(f'获取指标失败: {str(e)}', exc_info=True)
        return error_response(f'获取指标失败: {str(e)}', 500)


@case2pg_bp.route('/api/monitoring/alerts/check', methods=['POST'])
def check_system_alerts():
    """检查系统告警"""
    try:
        check_alerts()
        return success_response({}, '告警检查完成')
        
    except Exception as e:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.error(f'告警检查失败: {str(e)}', exc_info=True)
        return error_response(f'告警检查失败: {str(e)}', 500)


@case2pg_bp.route('/api/monitoring/status', methods=['GET'])
def system_status():
    """获取系统综合状态"""
    try:
        # 获取健康状态
        health = get_health_status()
        
        # 获取指标
        metrics = get_metrics()
        
        # 组合状态信息
        status = {
            'health': health,
            'metrics': {
                'requests': metrics.get('requests', {}),
                'request_stats': metrics.get('request_stats', {}),
                'system': metrics.get('system', {}),
                'database_stats': metrics.get('database_stats', {})
            },
            'uptime': metrics.get('timestamp'),
            'version': '1.0.0'  # 可以从配置或环境变量获取
        }
        
        return success_response(status, '获取系统状态成功')
        
    except Exception as e:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.error(f'获取系统状态失败: {str(e)}', exc_info=True)
        return error_response(f'获取系统状态失败: {str(e)}', 500)


@case2pg_bp.route('/api/monitoring/logs', methods=['GET'])
def get_recent_logs():
    """获取最近的日志（简单实现）"""
    try:
        # 获取查询参数
        level = request.args.get('level', 'INFO')
        limit = min(int(request.args.get('limit', 100)), 1000)  # 最多1000条
        
        # 这里是一个简化的实现，实际项目中可能需要更复杂的日志查询
        # 可以考虑使用 ELK Stack 或其他日志管理系统
        
        logs = {
            'message': '日志查询功能需要配置日志管理系统',
            'suggestion': '建议使用 ELK Stack 或类似的日志管理解决方案',
            'parameters': {
                'level': level,
                'limit': limit
            }
        }
        
        return success_response(logs, '日志查询接口')
        
    except Exception as e:
        logger = get_logger(__name__) if get_logger else None
        if logger:
            logger.error(f'获取日志失败: {str(e)}', exc_info=True)
        return error_response(f'获取日志失败: {str(e)}', 500)

def get_last_workflow_outputs():
    """获取最近一次工作流输出"""
    global last_workflow_outputs
    return last_workflow_outputs