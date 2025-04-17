export class Token {
    type: TokenType;
    content: string | Token[];

    constructor(type: TokenType, content: string | Token[]) {
        this.type = type;
        this.content = content;
    }
}

export enum TokenType {
    BlankLine,
    SceneHeading,
    SceneHeadingForce,
    SceneNumber,
    SceneNumberFence,
    Action,
    ActionForce,
    Character,
    CharacterForce,
    Dialogue,
    Parenthetical,
    DualDialogue,
    Lyric,
    LyricLeader,
    Transition,
    TransitionForce,
    CenterLeft,
    CenterRight,
    Escape,
    PageBreak,
    NoteOpen,
    NoteClose,
    BoneyardOpen,
    BoneyardClose,
    SectionHeading,
    SectionHeadingLeader,
    Synopsis,
    SynopsisLeader,
    TitlePage,
    TitlePageKey,
    TitlePageValue,
    Italic,
    Bold,
    Underline,
    Text,
}
