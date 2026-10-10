/**
 * Applies the stored surface before first paint.
 *
 * Reads the same persisted blob zustand writes (`cream.session`), so a visitor
 * who chose the paper surface never sees a flash of the dark one. Kept as a
 * blocking inline script because it must run before React hydrates.
 */
export function ThemeScript() {
  const code = `(function(){try{
    var raw=localStorage.getItem('cream.session');
    if(!raw)return;
    var parsed=JSON.parse(raw);
    var t=parsed&&parsed.state&&parsed.state.theme;
    if(t==='cream'||t==='espresso'){document.documentElement.setAttribute('data-theme',t);}
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} suppressHydrationWarning />;
}