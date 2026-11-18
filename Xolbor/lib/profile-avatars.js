'use strict';
const PROFILE_AVATARS = Object.freeze(Array.from({length: 8}, (_, index) => {
  const id = 'avatar-' + (index + 1);
  return Object.freeze({id, name: 'Avatar ' + (index + 1), description: 'Modèle 3D de la collection Xolbor.', price: index === 0 ? 0 : 100, model: '/public/assets/imported/' + id + '.glb'});
}));
const DEFAULT_AVATAR = PROFILE_AVATARS[0].id;
const profileAvatar = user => PROFILE_AVATARS.find(item => item.id === user.profileAvatar)?.id || DEFAULT_AVATAR;
module.exports = {PROFILE_AVATARS, DEFAULT_AVATAR, profileAvatar};
