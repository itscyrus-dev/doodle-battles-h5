// 入口：加载主程序；失败时在启动页上给出重试按钮。
try {
  await import('./app.mjs');
} catch (error) {
  console.error('game failed to start', error);
  const zh = (navigator.language || '').toLowerCase().startsWith('zh');
  document.getElementById('boot-status').textContent = zh ? '加载遇到问题，请重新加载。' : 'Something went wrong while loading. Please reload.';
  const retry = document.getElementById('boot-retry');
  retry.textContent = zh ? '重新加载' : 'Reload'; retry.hidden = false; retry.onclick = () => location.reload();
}
