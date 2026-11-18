'use strict';
window.XolborPortrait = (() => {
  const thumbnails = new Map();
  let renderer;
  const model = id => '/public/assets/imported/' + id + '.glb';

  function thumbnail(id, portrait) {
    const key = id + (portrait ? ':portrait' : ':full');
    if (!thumbnails.has(key)) {
      thumbnails.set(key, new THREE.GLTFLoader().loadAsync(model(id)).then(({scene: avatar}) => {
        if (!renderer) {
          renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: true});
          renderer.setSize(240, 240);
          renderer.outputEncoding = THREE.sRGBEncoding;
        }
        const scene = new THREE.Scene();
        scene.add(avatar, new THREE.HemisphereLight(0xffffff, 0x777777, 1.6));
        const bounds = new THREE.Box3().setFromObject(avatar);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3()).length();
        const camera = new THREE.PerspectiveCamera(36, 1, size / 100, size * 10);
        if (portrait) center.y += bounds.getSize(new THREE.Vector3()).y * .28;
        camera.position.copy(center).add(new THREE.Vector3(0, 0, -size * (portrait ? .8 : 1.7)));
        camera.lookAt(center);
        renderer.render(scene, camera);
        const png = renderer.domElement.toDataURL();
        avatar.traverse(object => {
          if (!object.isMesh) return;
          object.geometry.dispose();
          for (const material of [object.material].flat()) {
            for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
            material.dispose();
          }
        });
        return png;
      }));
    }
    return thumbnails.get(key);
  }

  function image(id, label, className) {
    const img = document.createElement('img');
    img.alt = label;
    img.className = className;
    thumbnail(id, className === 'portrait-image').then(src => { img.src = src; }).catch(() => {});
    return img;
  }

  function name(user, container) {
    container.textContent = user.username;
    if (user.founder) {
      const badge = document.createElement('img');
      badge.src = '/public/assets/imported/verified.png';
      badge.alt = 'Vérifié';
      badge.title = 'Compte vérifié';
      badge.className = 'verified-badge';
      container.append(' ', badge);
    }
    return container;
  }

  return {model, image, name, render(user, container) {
    if (user && container) container.replaceChildren(image(user.profileAvatar, 'Photo de profil de ' + user.username, 'portrait-image'));
  }};
})();
