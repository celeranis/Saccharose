export type RoleInfoQualityId = 4 | 5;
export type RoleInfoRoleType = 1 | 2 | 3 | 4;
export type RoleInfoRoleBody = 'FemaleM' | 'FemaleS' | 'FemaleXL' | 'MaleM' | 'MaleS' | 'MaleXL';

export interface RoleInfo {
  BreachId: number,
  BreachModel: number,
  CameraConfig: string,
  CameraFloatHeight: number,
  Card: string,
  CharacterVoice: string,
  CharacterVoiceText: string,
  ElementId: number,
  EntityProperty: number,
  ExchangeConsume: { Key: number, Value: number }[],
  FootStepState: string,
  FormationRoleCard: string,
  Icon: string,
  Id: number,
  InitWeaponItemId: number,
  Intervene: boolean,
  Introduction: string,
  IntroductionText: string,
  IsAim: boolean,
  IsShow: boolean,
  IsTrial: boolean,
  ItemQualityId: number,
  LevelConsumeId: number,
  LockOnDefaultId: number,
  LockOnLookOnId: number,
  MaxLevel: number,
  MeshId: number,
  Name: string,
  NameText: string,
  NickName: string,
  NickNameText: string,
  NumLimit: number,
  ParentId: number,
  PartyId: number,
  Priority: number,
  PropertyId: number,
  QualityId: RoleInfoQualityId,
  RedDotDisableRule: number,
  ResonanceId: number,
  ResonantChainGroupId: number,
  RoleBody: RoleInfoRoleBody,
  RoleGuide: number,
  RoleHeadIcon: string,
  RoleHeadIconBig: string,
  RoleHeadIconCircle: string,
  RoleHeadIconLarge: string,
  RolePortrait: string,
  RoleStand: string,
  RoleType: RoleInfoRoleType,
  ShowInBag: boolean,
  ShowProperty: number[],
  SkillDapath: string,
  SkillEffectDa: string,
  SkillId: number,
  SkillLockDapath: string,
  SkillTreeGroupId: number,
  SpecialEnergyBarId: number,
  SpilloverItem: { Key: number, Value: number }[],
  TrialRole: number,
  UiMeshId: number,
  UiScenePerformanceAbp: string,
  WeaponScale: number[],
  WeaponType: number,
}


export function isRover(avatar: number|RoleInfo, checkMode: 'male' | 'female' | 'either' = 'either'): boolean {
  if (!avatar) {
    return false;
  }
  if (typeof avatar !== 'number') {
    avatar = avatar.Id;
  }

  const maleIds = [1501, 1605];
  const femaleIds = [1502, 1604];

  if (checkMode === 'either') {
    return [... maleIds, ... femaleIds].includes(avatar);
  } else if (checkMode === 'male') {
    return maleIds.includes(avatar);
  } else {
    return femaleIds.includes(avatar);
  }
}
