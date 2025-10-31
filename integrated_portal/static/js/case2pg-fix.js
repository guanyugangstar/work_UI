/**
 * case2pg删除功能修复脚本
 * 为集成门户添加缺失的deleteRow函数和事件委托
 */

// 确保在DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    console.log('[case2pg-fix] 开始修复删除功能');
    
    // 检查是否已经存在deleteRow函数
    if (typeof window.deleteRow === 'function') {
        console.log('[case2pg-fix] deleteRow函数已存在，跳过修复');
        return;
    }
    
    // 定义deleteRow函数
    window.deleteRow = function(rowIndex) {
        console.log('deleteRow called with index:', rowIndex);
        
        if (!currentTableData || !currentTableData.rows[rowIndex]) {
            console.log('Invalid row index or no data');
            alert('无效的行索引');
            return;
        }
        
        // 获取要删除的行数据和主键
        const rowData = currentTableData.rows[rowIndex];
        const primaryKey = currentTableData.primary_key || '案号'; // 默认主键
        
        // 找到主键列的索引
        const primaryKeyIndex = currentTableData.columns.indexOf(primaryKey);
        if (primaryKeyIndex === -1) {
            console.error('找不到主键列:', primaryKey);
            alert('无法确定记录的主键，删除失败');
            return;
        }
        
        const recordId = rowData[primaryKeyIndex];
        console.log('准备删除记录:', recordId, '主键:', primaryKey);
        
        // 智能删除策略：检查主键是否为空
        let deletePayload = {
            table_name: currentTableData.table_name
        };
        
        let confirmMessage;
        if (recordId && recordId.toString().trim()) {
            // 主键不为空，使用主键删除
            deletePayload.record_id = recordId;
            confirmMessage = `确定要删除记录 "${recordId}" 吗？此操作不可撤销！`;
        } else {
            // 主键为空，使用行号删除
            deletePayload.row_index = rowIndex;
            confirmMessage = `该记录的主键为空，将使用行号(第${rowIndex + 1}行)进行删除。确定要删除吗？此操作不可撤销！`;
        }
        
        // 确认删除操作
        const confirmed = confirm(confirmMessage);
        console.log('用户确认结果:', confirmed);
        
        if (!confirmed) {
            console.log('用户取消删除操作');
            return; // 用户取消，直接返回，不执行任何删除操作
        }
        
        console.log('用户确认删除，开始执行删除操作，删除参数:', deletePayload);
        
        // 显示删除中的提示
        const deleteBtn = document.querySelector(`tr[data-row-index="${rowIndex}"] .delete-btn`);
        if (!deleteBtn) {
            alert('找不到删除按钮');
            return;
        }
        
        const originalText = deleteBtn.textContent;
        deleteBtn.textContent = '删除中...';
        deleteBtn.disabled = true;
        
        // 发送删除请求到后端 - 使用集成门户的路由
        fetch("/case2pg/delete_record", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(deletePayload)
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                // 只有在后端删除成功后才从本地数据中删除行
                currentTableData.rows.splice(rowIndex, 1);
                // 重新渲染表格
                if (typeof renderTable === 'function') {
                    renderTable();
                }
                alert('删除成功！');
            } else {
                // 删除失败，恢复按钮状态
                deleteBtn.textContent = originalText;
                deleteBtn.disabled = false;
                alert('删除失败: ' + (result.message || '未知错误'));
            }
        })
        .catch(error => {
            // 请求失败，恢复按钮状态
            deleteBtn.textContent = originalText;
            deleteBtn.disabled = false;
            console.error('删除请求失败:', error);
            alert('删除请求失败: ' + error.message);
        });
    };
    
    // 添加事件委托，处理删除按钮点击
    const modalTableResult = document.getElementById('modalTableResult');
    if (modalTableResult) {
        // 检查是否已经绑定了事件
        if (!modalTableResult.hasAttribute('data-delete-handler-bound')) {
            modalTableResult.addEventListener('click', function(e) {
                console.log('Click event on modalTableResult, target:', e.target);
                
                if (e.target.classList.contains('delete-btn')) {
                    console.log('Delete button clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    const rowIndex = parseInt(e.target.getAttribute('data-row-index'));
                    console.log('Row index from button:', rowIndex);
                    window.deleteRow(rowIndex);
                }
            });
            
            // 标记已绑定事件，避免重复绑定
            modalTableResult.setAttribute('data-delete-handler-bound', 'true');
            console.log('[case2pg-fix] 删除按钮事件委托已绑定');
        }
    } else {
        console.warn('[case2pg-fix] 未找到modalTableResult元素，稍后重试');
        // 如果元素还没有加载，延迟重试
        setTimeout(function() {
            const retryModalTableResult = document.getElementById('modalTableResult');
            if (retryModalTableResult && !retryModalTableResult.hasAttribute('data-delete-handler-bound')) {
                retryModalTableResult.addEventListener('click', function(e) {
                    console.log('Click event on modalTableResult, target:', e.target);
                    
                    if (e.target.classList.contains('delete-btn')) {
                        console.log('Delete button clicked');
                        e.preventDefault();
                        e.stopPropagation();
                        const rowIndex = parseInt(e.target.getAttribute('data-row-index'));
                        console.log('Row index from button:', rowIndex);
                        window.deleteRow(rowIndex);
                    }
                });
                
                retryModalTableResult.setAttribute('data-delete-handler-bound', 'true');
                console.log('[case2pg-fix] 删除按钮事件委托已绑定（重试成功）');
            }
        }, 1000);
    }
    
    console.log('[case2pg-fix] 删除功能修复完成');
});