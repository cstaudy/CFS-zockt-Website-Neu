(() => {
  const login = document.getElementById('loginPanel');
  const register = document.getElementById('registerPanel');
  const loginTab = document.getElementById('cfsLoginTab');
  const registerTab = document.getElementById('cfsRegisterTab');
  if (!login || !register || !loginTab || !registerTab) return;
  const show = (which, focus = false) => {
    const signingUp = which === 'register';
    login.hidden = signingUp;
    register.hidden = !signingUp;
    loginTab.setAttribute('aria-selected', String(!signingUp));
    registerTab.setAttribute('aria-selected', String(signingUp));
    loginTab.tabIndex = signingUp ? -1 : 0;
    registerTab.tabIndex = signingUp ? 0 : -1;
    if (focus) (signingUp ? registerTab : loginTab).focus();
  };
  const fromHash = () => show(/^(#regForm|#registerPanel)$/.test(location.hash) ? 'register' : 'login');
  loginTab.addEventListener('click', () => show('login', true));
  registerTab.addEventListener('click', () => show('register', true));
  for (const tab of [loginTab, registerTab]) tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    show(event.key === 'ArrowLeft' || event.key === 'Home' ? 'login' : 'register', true);
  });
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
