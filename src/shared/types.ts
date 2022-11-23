
export interface ConfigCondition {
  Type?: string,
  Param?: (string|number)[]
  Count?: string,
  ParamStr?: string,
}

export type LangCode = 'CHS' | 'CHT' | 'DE' | 'EN' | 'ES' | 'FR' | 'ID' | 'JP' | 'KR' | 'PT' | 'RU' | 'TH' | 'VI'; // TODO add IT/TR
export const LANG_CODES: LangCode[] = ['CHS', 'CHT', 'DE', 'EN', 'ES', 'FR', 'ID', 'JP', 'KR', 'PT', 'RU', 'TH','VI']; // TODO add IT/TR
export const LANG_CODES_TO_NAME = {
  CHS: 'Chinese (Simplified)',
  CHT: 'Chinese (Traditional)',
  DE: 'German',
  EN: 'English',
  ES: 'Spanish',
  FR: 'French',
  ID: 'Indonesian',
  //IT: 'Italian', // TODO
  JP: 'Japanese',
  KR: 'Korean',
  PT: 'Portuguese',
  RU: 'Russian',
  TH: 'Thai',
  //TR: 'Turkish', // TODO
  VI: 'Vietnamese',
}
export const LANG_CODES_TO_WIKI_CODE = {
  CHS: 'ZHS',
  CHT: 'ZHT',
  DE: 'DE',
  EN: 'EN',
  ES: 'ES',
  FR: 'FR',
  ID: 'ID',
  //IT: '', // TODO
  JP: 'JA',
  KR: 'KO',
  PT: 'PT',
  RU: 'RU',
  TH: 'TH',
  //TR: '', // TODO
  VI: 'VI',
}

// DIALOG CONFIG
// ~~~~~~~~~~~~~

export type TalkRoleType = 'TALK_ROLE_NPC' | 'TALK_ROLE_PLAYER' | 'TALK_ROLE_BLACK_SCREEN' | 'TALK_ROLE_MATE_AVATAR' | 'TALK_ROLE_GADGET'
  | 'TALK_ROLE_CONSEQUENT_BLACK_SCREEN' | 'TALK_ROLE_NEED_CLICK_BLACK_SCREEN' | 'TALK_ROLE_CONSEQUENT_NEED_CLICK_BLACK_SCREEN';
export interface TalkRole {
  Type: TalkRoleType,
  Id: number|string,
  NameTextMapHash?: number,
  NameText?: string,
}

export interface DialogExcelConfigData {
  Id: number,
  NextDialogs: number[],
  TalkShowType?: 'TALK_SHOW_FORCE_SELECT',
  TalkRole: TalkRole,
  TalkContentTextMapHash: number,
  TalkContentText?: string,
  TalkTitleTextMapHash: number,
  TalkTitleTextMap?: string,
  TalkRoleNameTextMapHash: number,
  TalkRoleNameText?: string,
  TalkAssetPath: string,
  TalkAssetPathAlter: string,
  TalkAudioName: string,
  ActionBefore: string,
  ActionWhile: string,
  ActionAfter: string,
  OptionIcon: string,
  Branches?: DialogExcelConfigData[][],
  Recurse?: boolean
}

export interface TalkExcelConfigData {
  Id: number,
  QuestId: number,
  QuestCondStateEqualFirst: number,
  BeginWay: string,
  ActiveMode: string,
  BeginCondComb: string,
  BeginCond: ConfigCondition[],
  Priority: number,
  NextTalks: number[],
  NextTalksDataList: TalkExcelConfigData[],
  InitDialog: number,
  NpcId: number[],
  NpcDataList?: NpcExcelConfigData[],
  NpcNameList?: string[],
  ParticipantId: number[],
  PerformCfg: string,
  QuestIdleTalk: boolean,
  HeroTalk: string,
  ExtraLoadMarkId: number[],
  PrePerformCfg: string,
  FinishExec: ConfigCondition[]
  Dialog?: DialogExcelConfigData[],
}

// NPC CONFIG
// ~~~~~~~~~~

export interface NpcExcelConfigData {
  JsonName: string,
  Alias: string,
  ScriptDataPath: string,
  LuaDataPath: string,
  DyePart: string,
  BillboardIcon: string,
  TemplateEmotionPath: string,
  Id: number,
  NameText?: string,
  NameTextMapHash: number,
  PrefabPathHashSuffix: number,
  PrefabPathHashPre: number,
  CampId: number,
  LODPatternName: string,
  BodyType?: string,
}

// QUEST CONFIG
// ~~~~~~~~~~~~

export type QuestType = 'AQ' | 'SQ' | 'EQ' | 'WQ';
export type MapByQuestType<T> = {
  AQ: T,
  SQ: T,
  EQ: T,
  WQ: T
};

export interface MainQuestExcelConfigData {
  Id: number,
  Series: number,
  ChapterId?: number,
  Type?: QuestType,
  ActiveMode: string,
  TitleText?: string,
  TitleTextEN?: string,
  TitleTextMapHash: number,
  DescText?: string,
  DescTextMapHash: number,
  LuaPath: string,
  SuggestTrackOutOfOrder?: boolean,
  SuggestTrackMainQuestList?: any[],
  RewardIdList: any[],
  ShowType: string,
  QuestExcelConfigDataList?: QuestExcelConfigData[],
  OrphanedTalkExcelConfigDataList?: TalkExcelConfigData[],
  OrphanedDialog?: DialogExcelConfigData[][],
  QuestMessages?: ManualTextMapConfigData[],
}

export interface QuestExcelConfigData {
  SubId: number,
  MainId: number,
  Order: number,
  DescText?: string,
  DescTextMapHash: number,
  StepDescText?: string,
  StepDescTextMapHash: number,
  ShowType: string, // e.g. "QUEST_HIDDEN"

  // Guide
  Guide: ConfigCondition,
  GuideTipsText?: string,
  GuideTipsTextMapHash: number,

  // Cond/Exec (no longer available?)
  AcceptCond: ConfigCondition[],
  AcceptCondComb: string,
  FinishCond: ConfigCondition[],
  FinishCondComb: string,
  FailCond: ConfigCondition[],
  FailCondComb: string,
  FinishExec: ConfigCondition[],
  FailExec: ConfigCondition[],
  BeginExec: ConfigCondition[],

  // NPC/Avatar (no longer available?)
  ExclusiveNpcList: number[],
  SharedNpcList: number[],
  TrialAvatarList: any[],
  ExclusivePlaceList: any[],

  // Custom:
  TalkExcelConfigDataList?: TalkExcelConfigData[],
  QuestMessages?: ManualTextMapConfigData[],
  OrphanedDialog?: DialogExcelConfigData[][],
}

// RANDOM STUFF
// ~~~~~~~~~~~~

export interface LoadingTipsExcelConfigData {
  Id: number,
  TipsTitleText?: string,
  TipsTitleTextMapHash: number,
  TipsDescText?: string,
  TipsDescTextMapHash: number,
  StageId: string,
  StartTime: string,
  EndTime: string,
  LimitOpenState: string,
  PreMainQuestIds: string,
  Weight: number
}

export interface ManualTextMapConfigData {
  TextMapId: string,
  TextMapContentText?: string,
  TextMapContentTextMapHash: number,
  ParamTypes: string[],
}

export interface AvatarExcelConfigData {
  Id: number
  NameText: string,
  NameTextMapHash: number,
  DescText: string,
  DescTextMapHash: number,
  WeaponType: string,
  BodyType: string,
  IconName: string,
  SideIconName: string,
}

export interface FetterCondSummary {
  Friendship?: number,
  Quest?: string,

  AscensionPhase?: number, //
  Birthday?: boolean,
  Waypoint?: string, // only for Traveler VOs
  Statue?: string, // only for Traveler VOs
}

export type FetterCondType =
  'FETTER_COND_AVATAR_PROMOTE_LEVEL' |  // ascension phase
  'FETTER_COND_FETTER_LEVEL' |          // friendship
  'FETTER_COND_FINISH_PARENT_QUEST' |   // quest requirement (Param is MainQuestExcelConfigData ID)
  'FETTER_COND_FINISH_QUEST' |          // quest requirement (Param is QuestExcelConfigData ID)
  'FETTER_COND_PLAYER_BIRTHDAY' |       // player birthday
  'FETTER_COND_UNLOCK_TRANS_POINT';     // unlock waypoint
export type FetterCond = {
  CondType: FetterCondType,
  ParamList: number[]
};
export interface FetterWithConditions {
  OpenConds?: FetterCond[],
  FinishConds?: FetterCond[],
  OpenCondsSummary?: FetterCondSummary,
  FinishCondsSummary?: FetterCondSummary,
  Tips: number[],
  MappedTips?: string[],
}

export interface FetterStoryExcelConfigData extends FetterWithConditions {
  FetterId: number,
  AvatarId: number,
  Avatar?: AvatarExcelConfigData,

  StoryTitleTextMapHash: number,
  StoryContextTextMapHash: number,
  StoryTitleText: string,
  StoryContextText: string,
  StoryContextHtml: string,

  StoryTitle2TextMapHash: number,
  StoryContext2TextMapHash: number,
  StoryTitle2Text: string,
  StoryContext2Text: string,
  StoryContext2Html: string,

  StoryTitleLockedTextMapHash?: number,
}

export interface FetterExcelConfigData extends FetterWithConditions {
  Type: 1|2,
  VoiceFile: string,
  VoiceTitleTextMapHash: number,
  VoiceFileTextTextMapHash: number,
  VoiceTitleLockedTextMapHash: number,
  FetterId: number,
  AvatarId: number,
  IsHiden: boolean, // this is misspelled in the source JSON, do not fix
  HideCostumeList: number[],
  ShowCostumeList: number[],

  VoiceTitleText?: string,
  VoiceFileTextText?: string,
  VoiceTitleLockedText?: string,
  Avatar?: AvatarExcelConfigData,
}

export interface ReminderExcelConfigData {
  Id: number,
  SpeakerText: string,
  SpeakerTextMapHash: number,
  ContentText: string,
  ContentTextMapHash: number,
  Delay: number,
  ShowTime: number,
  NextReminderId: number,
  SoundEffect: string,
  HasAudio: boolean,
}

export interface ChapterExcelConfigData {
  Id: number,
  BeginQuestId: number,
  EndQuestId: number,
  ChapterNumText: string
  ChapterNumTextMapHash: number,
  ChapterTitleText: string,
  ChapterTitleTextMapHash: number,
  ChapterIcon: string,
  ChapterImageHashSuffix: number,
  ChapterImageHashPre: number,
  ChapterImageTitleText: string,
  ChapterImageTitleTextMapHash: number,
  ChapterSerialNumberIcon: string
  NeedPlayerLevel?: number,
  Type?: QuestType,
  Quests?: MainQuestExcelConfigData[],
}

export interface RewardExcelConfigData {
  RewardId: number,
  RewardItemList: {
    ItemId?: number,
    ItemCount?: number,
    Material?: MaterialExcelConfigData
  }[],
  RewardWikitext?: string,
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
  GlobalItemLimit?: number,
  EffectDesc?: string,
  EffectDescTextMapHash?: number,
  EffectGadgetId?: number,
  GadgetId?: number,
  SpecialDesc?: string,
  SpecialDescTextMapHash?: number,
  TypeDesc?: string,
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

export interface DungeonExcelConfigData {
  Id: number,
  NameTextMapHash: number,
  NameText: string,
  DisplayNameTextMapHash: number,
  DisplayNameText: string,
  DescTextMapHash: number,
  DescText: string,
  Type: string,
  SceneId: number,
  InvolveType: string,
  ShowLevel: number,
  LimitLevel: number,
  LevelRevise: number,
  PassCond: number,
  ReviveMaxCount: number,
  DayEnterCount: number,
  EnterCostItems: any[]
  PassRewardPreviewId: number,
  SettleCountdownTime: number,
  FailSettleCountdownTime: number,
  QuitSettleCountdownTime: number,
  SettleShows: string[],
  ForbiddenRestart: boolean,
  SettleUIType: string,
  RecommendElementTypes: string[],
  RecommendTips: any[],
  LevelConfigMap: any,
  PreviewMonsterList: number[],
  GearDescTextMapHash: number,
  CityId: number,
  EntryPicPath: string,
  StateType: string,
  FactorPic: string,
  FactorIcon: string,
  AvatarLimitType: number,
  IsDynamicLevel: boolean,
  SubType: string,
  SerialId: number,
  FirstPassRewardPreviewId: number,
  PassJumpDungeon: number,
  DontShowPushTips: boolean,
  PlayType: string,
  EventInterval: number,
  ReviveIntervalTime: number,
  StatueCostId: number,
  StatueCostCount: number,
  StatueDrop: number,
}

export interface HomeWorldEventExcelConfigData {
  EventId: number,
  EventType: 'HOME_AVATAR_SUMMON_EVENT' | 'HOME_AVATAR_REWARD_EVENT',
  AvatarId: number,
  Avatar?: AvatarExcelConfigData,
  TalkId: number,
  RewardId: number,
  FurnitureSuitId: number,
  Order: number,
}

export interface HomeWorldNPCExcelConfigData {
  FurnitureId: number,
  AvatarId: number,
  Avatar?: AvatarExcelConfigData,
  NpcId: number,
  Npc?: NpcExcelConfigData,
  TalkIds: number[],
  ShowNameTextMapHash: number,
  DescTextMapHash: number,
  RewardEvents: HomeWorldEventExcelConfigData[],
  SummonEvents: HomeWorldEventExcelConfigData[],
  IsNPC?: boolean,
}