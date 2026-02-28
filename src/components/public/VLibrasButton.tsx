import { useEffect } from 'react';

declare global {
  interface Window {
    VLibras: any;
    VLibPlugin: any;
  }
}

export default function VLibrasButton() {
  useEffect(() => {
    // Evita duplicação
    if (document.getElementById('vlibras-wrapper')) return;

    // Cria a estrutura HTML que o VLibras exige no body
    const wrapper = document.createElement('div');
    wrapper.id = 'vlibras-wrapper';
    wrapper.setAttribute('vw', '');
    wrapper.classList.add('enabled');

    const accessButton = document.createElement('div');
    accessButton.setAttribute('vw-access-button', '');
    accessButton.classList.add('active');

    const pluginWrapper = document.createElement('div');
    pluginWrapper.setAttribute('vw-plugin-wrapper', '');

    const topWrapper = document.createElement('div');
    topWrapper.className = 'vw-plugin-top-wrapper';

    pluginWrapper.appendChild(topWrapper);
    wrapper.appendChild(accessButton);
    wrapper.appendChild(pluginWrapper);
    document.body.appendChild(wrapper);

    // Carrega o script apenas uma vez
    if (document.getElementById('vlibras-script')) return;

    const script = document.createElement('script');
    script.id = 'vlibras-script';
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.async = true;

    script.onload = () => {
      if (window.VLibras?.Widget) {
        new window.VLibras.Widget('https://vlibras.gov.br/app');
      }
    };

    script.onerror = () => {
      console.error('Erro ao carregar script do VLibras');
    };

    document.body.appendChild(script);
  }, []);

  return null;
}
