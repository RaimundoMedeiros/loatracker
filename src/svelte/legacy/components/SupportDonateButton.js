export function mountSupportDonateButton({
  kofiUrl = 'https://ko-fi.com/mediun',
  livepixUrl = 'https://livepix.gg/mediun',
} = {}) {
  const existing = document.querySelector('.support-donate-wrapper');
  if (existing) {
    existing.remove();
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'support-donate-wrapper';

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'support-donate-toggle';
  toggleButton.setAttribute('aria-haspopup', 'true');
  toggleButton.setAttribute('aria-expanded', 'false');

  const maskId = `kofi-mask-${Math.random().toString(36).slice(2, 10)}`;

  const kofiIconSvg = `
    <svg aria-hidden="true" focusable="false" class="support-kofi-icon" viewBox="0 0 241 194" fill="none" xmlns="http://www.w3.org/2000/svg">
      <mask id="${maskId}" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="-1" y="0" width="242" height="194">
        <path d="M240.469 0.959H-0.006v192.959h240.475V0.959Z" fill="white" />
      </mask>
      <g mask="url(#${maskId})">
        <path d="M96.134 193.911C61.131 193.911 32.66 178.256 15.972 149.829 1.198 124.912-0.006 97.923-0.006 67.766-0.006 49.888 5.373 34.322 15.541 22.747 24.886 12.116 38.127 5.229 52.832 3.354 70.286 1.143 91.985 0.959 114.545 0.959c36.714 0 47.085.449 61.53 1.894 19.215 1.907 35.383 9.079 46.749 20.743 11.544 11.847 17.645 27.667 17.645 45.768v3.636c0 30.886-20.648 56.734-49.423 63.76-2.148 5.068-4.809 10.112-7.957 15.078l-.083.127c-10.137 15.668-33.964 41.954-79.605 41.954h-7.273l.006-.007Z" fill="white" />
        <path d="M174.568 17.977C160.927 16.615 151.38 16.159 114.552 16.159c-23.644 0-43.651.228-59.788 2.274-21.369 2.731-39.558 19.096-39.558 49.335 0 30.239 1.59 53.655 13.868 74.34 13.869 23.644 37.057 36.6 67.068 36.6h7.273c36.828 0 56.836-19.551 66.839-35.009 4.321-6.824 7.501-13.64 9.548-20.464 26.146-2.274 45.469-23.872 45.469-50.24v-3.636c0-28.414-18.639-48.193-50.696-51.38h-.006Z" fill="white" />
        <path d="M15.198 67.767c0-30.239 18.19-46.603 39.559-49.334 16.143-2.046 36.15-2.274 59.789-2.274 36.828 0 46.375.456 60.016 1.818 32.058 3.18 50.696 22.959 50.696 51.38v3.637c0 26.374-19.323 47.971-45.469 50.239-2.046 6.824-5.227 13.64-9.548 20.464-10.003 15.458-30.01 35.009-66.838 35.009h-7.274c-30.011 0-53.198-12.956-67.066-36.6C16.781 121.422 15.19 98.456 15.19 67.767" fill="#202020" />
        <path d="M32.247 67.99c0 29.327 1.818 48.194 11.366 65.699 10.91 20.235 30.69 27.964 53.2 27.964h7.045c29.554 0 43.879-14.324 51.836-26.824 3.865-6.367 7.273-13.412 9.091-22.282l1.363-5.683h8.185c18.189 0 33.876-14.774 33.876-33.647v-3.409c0-21.141-13.184-32.285-36.15-35.009-12.956-1.134-20.686-1.59-57.52-1.59-24.778 0-42.511.228-55.923 2.274-18.867 2.731-26.375 13.413-26.375 32.508" fill="white" />
        <path d="M166.158 83.68c0 2.731 2.046 4.777 5.683 4.777 11.594 0 17.961-6.595 17.961-17.505 0-10.909-6.367-17.732-17.961-17.732-3.637 0-5.683 2.046-5.683 4.777v25.683Z" fill="#202020" />
        <path d="M54.532 82.32c0 13.412 7.501 25.006 17.049 34.104 6.367 6.138 16.37 12.506 23.188 16.598 2.046 1.134 4.092 1.818 6.367 1.818 2.73 0 4.998-.684 6.823-1.818 6.823-4.092 16.82-10.46 22.959-16.598 9.775-9.092 17.276-20.686 17.276-34.104 0-14.553-10.909-27.509-26.596-27.509-9.319 0-15.687 4.777-20.463 11.366-4.321-6.595-10.91-11.366-20.236-11.366-15.914 0-26.374 12.956-26.374 27.509" fill="#FF5A16" />
      </g>
    </svg>
  `;

  toggleButton.innerHTML = `${kofiIconSvg}<span>Support me on Ko-fi | LivePix</span>`;

  const menu = document.createElement('div');
  menu.className = 'support-donate-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const kofiLink = document.createElement('a');
  kofiLink.href = kofiUrl;
  kofiLink.target = '_blank';
  kofiLink.rel = 'noopener noreferrer';
  kofiLink.className = 'support-donate-link';
  kofiLink.innerHTML = `
    <span class="support-donate-link-title">
      Ko-fi
      <svg aria-hidden="true" focusable="false" class="support-external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 5h5v5" />
        <path d="M10 14 19 5" />
        <path d="M19 13v6H5V5h6" />
      </svg>
    </span>
    <span class="support-donate-link-subtitle">ko-fi.com/mediun</span>
  `;

  const livepixLink = document.createElement('a');
  livepixLink.href = livepixUrl;
  livepixLink.target = '_blank';
  livepixLink.rel = 'noopener noreferrer';
  livepixLink.className = 'support-donate-link';
  livepixLink.innerHTML = `
    <span class="support-donate-link-title">
      LivePix
      <svg aria-hidden="true" focusable="false" class="support-external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 5h5v5" />
        <path d="M10 14 19 5" />
        <path d="M19 13v6H5V5h6" />
      </svg>
    </span>
    <span class="support-donate-link-subtitle">livepix.gg/mediun</span>
  `;

  menu.appendChild(kofiLink);
  menu.appendChild(livepixLink);
  wrapper.appendChild(toggleButton);
  wrapper.appendChild(menu);
  document.body.appendChild(wrapper);

  let open = false;

  const closeMenu = () => {
    open = false;
    menu.hidden = true;
    toggleButton.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    open = true;
    menu.hidden = false;
    toggleButton.setAttribute('aria-expanded', 'true');
  };

  toggleButton.addEventListener('click', () => {
    if (open) {
      closeMenu();
      return;
    }
    openMenu();
  });

  const onOutsidePointer = (event) => {
    if (!open) return;
    if (!wrapper.contains(event.target)) {
      closeMenu();
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      closeMenu();
    }
  };

  const onMenuLinkClick = () => {
    closeMenu();
  };

  kofiLink.addEventListener('click', onMenuLinkClick);
  livepixLink.addEventListener('click', onMenuLinkClick);
  document.addEventListener('pointerdown', onOutsidePointer);
  document.addEventListener('keydown', onKeyDown);

  return {
    destroy() {
      document.removeEventListener('pointerdown', onOutsidePointer);
      document.removeEventListener('keydown', onKeyDown);
      wrapper.remove();
    },
  };
}
