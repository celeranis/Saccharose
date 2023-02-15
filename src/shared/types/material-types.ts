// The Material IDs of some useful items:
export const ADVENTURE_EXP_ID = 102;
export const PRIMOGEM_ID = 201;
export const MORA_ID = 202;


export interface RewardSummary {
  ExpCount: string,
  MoraCount: string,
  PrimogemCount: string,
  OtherCards: string,
  CombinedStrings: string,
  CombinedCards: string,
  QuestForm: string,
}

export interface RewardExcelConfigData {
  RewardId: number,
  RewardItemList: {
    ItemId?: number,
    ItemCount?: number,
    Material?: MaterialExcelConfigData
  }[],
  RewardSummary?: RewardSummary,
}

export type MaterialType =
  'MATERIAL_ACTIVITY_GEAR' |
  'MATERIAL_ACTIVITY_JIGSAW' |
  'MATERIAL_ACTIVITY_ROBOT' |
  'MATERIAL_ADSORBATE' |
  'MATERIAL_ARANARA' |
  'MATERIAL_AVATAR' |
  'MATERIAL_AVATAR_MATERIAL' |
  'MATERIAL_BGM' |
  'MATERIAL_CHANNELLER_SLAB_BUFF' |
  'MATERIAL_CHEST' |
  'MATERIAL_CHEST_BATCH_USE' |
  'MATERIAL_CONSUME' |
  'MATERIAL_CONSUME_BATCH_USE' |
  'MATERIAL_COSTUME' |
  'MATERIAL_CRICKET' |
  'MATERIAL_DESHRET_MANUAL' |
  'MATERIAL_ELEM_CRYSTAL' |
  'MATERIAL_EXCHANGE' |
  'MATERIAL_EXP_FRUIT' |
  'MATERIAL_FAKE_ABSORBATE' |
  'MATERIAL_FIREWORKS' |
  'MATERIAL_FISH_BAIT' |
  'MATERIAL_FISH_ROD' |
  'MATERIAL_FLYCLOAK' |
  'MATERIAL_FOOD' |
  'MATERIAL_FURNITURE_FORMULA' |
  'MATERIAL_FURNITURE_SUITE_FORMULA' |
  'MATERIAL_HOME_SEED' |
  'MATERIAL_NAMECARD' |
  'MATERIAL_NOTICE_ADD_HP' |
  'MATERIAL_QUEST' |
  'MATERIAL_RELIQUARY_MATERIAL' |
  'MATERIAL_SEA_LAMP' |
  'MATERIAL_SELECTABLE_CHEST' |
  'MATERIAL_SPICE_FOOD' |
  'MATERIAL_TALENT' |
  'MATERIAL_WEAPON_EXP_STONE' |
  'MATERIAL_WIDGET' |
  'MATERIAL_WOOD';
export type MaterialUseTarget =
  'ITEM_USE_TARGET_CUR_TEAM' |
  'ITEM_USE_TARGET_SPECIFY_ALIVE_AVATAR' |
  'ITEM_USE_TARGET_PLAYER_AVATAR' |
  'ITEM_USE_TARGET_SPECIFY_AVATAR' |
  'ITEM_USE_TARGET_SPECIFY_DEAD_AVATAR';
export type MaterialItemUseOp =
  'ITEM_USE_ACCEPT_QUEST' |
  'ITEM_USE_ADD_ALL_ENERGY' |
  'ITEM_USE_ADD_AVATAR_EXTRA_PROPERTY' |
  'ITEM_USE_ADD_CHANNELLER_SLAB_BUFF' |
  'ITEM_USE_ADD_CUR_HP' |
  'ITEM_USE_ADD_CUR_STAMINA' |
  'ITEM_USE_ADD_DUNGEON_COND_TIME' |
  'ITEM_USE_ADD_ELEM_ENERGY' |
  'ITEM_USE_ADD_EXP' |
  'ITEM_USE_ADD_ITEM' |
  'ITEM_USE_ADD_PERSIST_STAMINA' |
  'ITEM_USE_ADD_REGIONAL_PLAY_VAR' |
  'ITEM_USE_ADD_RELIQUARY_EXP' |
  'ITEM_USE_ADD_SELECT_ITEM' |
  'ITEM_USE_ADD_SERVER_BUFF' |
  'ITEM_USE_ADD_TEMPORARY_STAMINA' |
  'ITEM_USE_ADD_WEAPON_EXP' |
  'ITEM_USE_CHEST_SELECT_ITEM' |
  'ITEM_USE_COMBINE_ITEM' |
  'ITEM_USE_GAIN_AVATAR' |
  'ITEM_USE_GAIN_CARD_PRODUCT' |
  'ITEM_USE_GAIN_COSTUME' |
  'ITEM_USE_GAIN_FLYCLOAK' |
  'ITEM_USE_GAIN_NAME_CARD' |
  'ITEM_USE_GRANT_SELECT_REWARD' |
  'ITEM_USE_MAKE_GADGET' |
  'ITEM_USE_OPEN_RANDOM_CHEST' |
  'ITEM_USE_RELIVE_AVATAR' |
  'ITEM_USE_UNLOCK_CODEX' |
  'ITEM_USE_UNLOCK_COMBINE' |
  'ITEM_USE_UNLOCK_COOK_RECIPE' |
  'ITEM_USE_UNLOCK_FORGE' |
  'ITEM_USE_UNLOCK_FURNITURE_FORMULA' |
  'ITEM_USE_UNLOCK_FURNITURE_SUITE' |
  'ITEM_USE_UNLOCK_HOME_BGM' |
  'ITEM_USE_UNLOCK_HOME_MODULE' |
  'ITEM_USE_UNLOCK_PAID_BATTLE_PASS_NORMAL';

export interface MaterialExcelConfigData {
  Id: number,
  NameText: string,
  NameTextMapHash: number
  DescText?: string,
  DescTextMapHash?: number,
  Icon?: string,
  ItemType?: 'ITEM_VIRTUAL' | 'ITEM_MATERIAL',
  StackLimit?: number,
  MaxUseCount?: number,
  UseTarget?: MaterialUseTarget,
  UseOnGain?: boolean,
  UseLevel?: number,
  Weight?: number,
  SetId?: number,
  CloseBagAfterUsed?: boolean,
  PlayGainEffect?: number,
  MaterialType?: MaterialType,
  Rank?: number,
  RankLevel?: number,
  GlobalItemLimit?: number,
  EffectDesc?: string,
  EffectDescTextMapHash?: number,
  EffectGadgetId?: number,
  GadgetId?: number,
  SpecialDesc?: string,
  SpecialDescTextMapHash?: number,
  TypeDescText?: string,
  TypeDescTextMapHash?: number,
  EffectIcon?: string,
  EffectName?: string,
  SatiationParams?: any[],
  DestroyRule?: string, // DESTROY_RETURN_MATERIAL
  DestroyReturnMaterial?: any[],
  DestroyReturnMaterialCount?: any[],
  ItemUse?: {
    UseOp: MaterialItemUseOp,
    UseParam: string[],
    // ITEM_USE_UNLOCK_FURNITURE_FORMULA => ["371119"]]
    // ITEM_USE_ADD_SERVER_BUFF => ["500202", "900"]
  }[],
  InteractionTitleText?: string,
  InteractionTitleTextMapHash?: number,
  FoodQuality?: 'FOOD_QUALITY_STRANGE' | 'FOOD_QUALITY_ORDINARY' | 'FOOD_QUALITY_DELICIOUS',
  IsHidden?: boolean,
  CdTime?: number,
  CdGroup?: number,
  SourceData?: MaterialSourceDataExcelConfigData,
}

export interface MaterialSourceDataExcelConfigData {
  Id: number,
  DungeonList: number[],
  JumpList: number[],
  TextList: number[],
  MappedTextList: string[],
}