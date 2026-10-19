import { installApp, usePwa } from '../pwa';

export function InstallApp() {
  const pwa = usePwa();
  if (window.desktop) return null;
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  return (
    <section className="card">
      <h2>装进口袋</h2>
      <p>安卓和 iPhone 都可以把游戏添加到主屏幕，用独立窗口打开。</p>
      <p role="status">
        {pwa.offlineReady
          ? '离线资源已就绪，下次没有网络也能打开游戏。'
          : pwa.failed
            ? '暂未完成离线缓存。请联网重新打开，或换用系统浏览器。'
            : '正在准备离线资源，请先保持联网。'}
      </p>
      {standalone ? (
        <p>你正在主屏幕 App 中游玩。</p>
      ) : (
        <>
          {pwa.canInstall && <button onClick={() => void installApp()}>安装到主屏幕</button>}
          <p>
            <strong>安卓：</strong>用 Chrome
            打开网址，在浏览器菜单中选择“安装应用”或“添加到主屏幕”。
          </p>
          <p>
            <strong>iPhone / iPad：</strong>用 Safari
            打开网址，点“分享”→“添加到主屏幕”；若出现“作为网页 App 打开”，请开启。
          </p>
          <p className="muted">在微信里打开时，请先从右上角菜单选择在浏览器中打开。</p>
        </>
      )}
      {pwa.updateReady && (
        <p role="status">
          新版已下载。先保存，再关闭所有游戏标签页和 App 窗口；下次打开会使用新版。
        </p>
      )}
      <p className="muted">
        进度只存在本机。安装前建议在下方导出存档；若主屏幕 App
        没有原进度，可导入继续。换设备也需要导出 / 导入。清理网站数据会删除存档和离线资源。
      </p>
      <p className="muted">关闭后不会常驻后台；再次打开时，会按经过的时间补算 TA 的生活。</p>
    </section>
  );
}
