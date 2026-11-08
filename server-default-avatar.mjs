import {mediaReference} from './server-media.mjs';

export const avatarPresets=['slate','moss','wine','sand','dusk'];
export const defaultAvatar=preset=>avatarPresets.includes(preset)?`/assets/avatar-pixel-${preset}.debac0c8de54.svg`:'';
export const robotAvatar=id=>defaultAvatar(avatarPresets[Math.abs(Number(id)||0)%avatarPresets.length]);
export function storedAvatar(id,value,preset,size=64){return value?mediaReference('avatar',id,value,size):defaultAvatar(preset);}
export function installAvatarPresets(db){if(!db.prepare('PRAGMA table_info(profiles)').all().some(c=>c.name==='avatar_preset'))db.exec("ALTER TABLE profiles ADD COLUMN avatar_preset TEXT NOT NULL DEFAULT ''");}
