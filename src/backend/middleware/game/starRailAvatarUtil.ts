import { StarRailControl } from '../../domain/hsr/starRailControl';
import { AvatarConfig } from '../../../shared/types/hsr/hsr-avatar-types';
import { cached } from '../../util/cache';
import jsonMask from 'json-mask';
import { Request } from 'express';
import { isInt, toInt } from '../../../shared/util/numberUtil';
import { isString } from '../../../shared/util/stringUtil';

const avatarMaskProps: string =
  'Id,' +
  'BaseType,' +
  'BaseTypeData,' +
  'DamageType,' +
  'Rarity,' +
  'MaxPromotion,' +
  'MaxRank,' +
  'NameText,' +
  'NameTextMapHash,' +
  'DescText,' +
  'DescTextMapHash,' +
  'FullNameText,' +
  'FullNameTextMapHash,' +
  'CutinIntroText,' +
  'CutinIntroTextMapHash,' +
  'ActionHeadIconPath,' +
  'MiniIconPath,' +
  'SideIconPath,' +
  'DefaultHeadIconPath,' +
  'SideHeadIconPath,' +
  'WaitingHeadIconPath,' +
  'GachaResultImgPath,' +
  'CutinBgImgPath,' +
  'CutinFrontImgPath,' +
  'CutinImgPath';

export async function getStarRailAvatars(ctrl: StarRailControl): Promise<AvatarConfig[]> {
  return cached('StarRail_AvatarListCache_' + ctrl.outputLangCode, async () => {
    return (await ctrl.selectAllAvatars())
      .map(a => jsonMask(a, avatarMaskProps))
      .sort((a,b) => a.NameText.localeCompare(b.NameText));
  });
}

export async function getStarRailAvatar(ctrl: StarRailControl, req: Request): Promise<AvatarConfig> {
  const avatars = await getStarRailAvatars(ctrl);

  const arg: string|number = ['avatarId', 'avatarName', 'avatar', 'id']
    .map(key => req.params[key] || <string> req.query[key]).find(val => !!val);

  if (!arg) {
    return null;
  } else if (isInt(arg)) {
    return avatars.find(a => a.Id === toInt(arg));
  } else if (isString(arg)) {
    const nameCmp = arg.toLowerCase().replace(/_/g, ' ');
    const ret = avatars.find(a => nameCmp === a.NameText.toLowerCase());
    if (ret) {
      return ret;
    } else {
      for (let avatar of avatars) {
        const langCodeMap = await ctrl.createLangCodeMap(avatar.NameTextMapHash, false);
        for (let name of Object.values(langCodeMap)) {
          if (nameCmp === name?.toLowerCase()) {
            req.context.htmlMetaProps['X-ChangeAvatarNameInURL'] = arg + ';' + avatar.NameText;
            return avatar;
          }
        }
      }
    }
    return null;
  }
}