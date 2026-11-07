export class BlockToken {
    type: BlockTokenType;
    content: RunToken[];
    centered?: boolean;
    couldBeChar?: boolean;

    constructor(
        type: BlockTokenType,
        content: RunToken[],
        centered?: boolean,
        couldBeChar?: boolean
    ) {
        this.type = type;
        this.content = content;
        if (centered) this.centered = centered;
        if (couldBeChar) this.couldBeChar = couldBeChar;
    }

    allowsInlineStyles(): boolean {
        return !(
            this.type === BlockTokenType.SectionHeading ||
            this.type === BlockTokenType.Synopsis
        );
    }
}

export class RunToken {
    type: RunTokenType;
    content: string | RunToken[];

    constructor(type: RunTokenType, content: string | RunToken[]) {
        this.type = type;
        this.content = content;
    }
    
    isMultilineStyle(): boolean {
        return (
            this.type === RunTokenType.BoneyardOpen ||
            this.type === RunTokenType.BoneyardClose ||
            this.type === RunTokenType.NoteOpen ||
            this.type === RunTokenType.NoteClose
        );
    }
}

export class StyleToken extends RunToken {
    active: boolean;

    constructor(type: RunTokenType, content: string, active?: boolean) {
        super(type, content);
        this.active = active || false;
    }

    isOpener(): boolean {
        return (
            this.type === RunTokenType.BoneyardOpen ||
            this.type === RunTokenType.NoteOpen
        );
    }
    
    isCloser(): boolean {
        return (
            this.type === RunTokenType.BoneyardClose ||
            this.type === RunTokenType.NoteClose
        );
    }
}

export enum BlockTokenType {
    BlankLine,
    SceneHeading,
    Action,
    Character,
    Dialogue,
    Parenthetical,
    Lyric,
    Transition,
    PageBreak,
    SectionHeading,
    Synopsis,
    TitlePage
}

export enum RunTokenType {
    SceneHeadingForce,
    SceneNumber,
    SceneNumberFence,
    ActionForce,
    CharacterForce,
    DualDialogue,
    LyricLeader,
    TransitionForce,
    CenterLeft,
    CenterRight,
    Escape,
    NoteOpen,
    NoteClose,
    BoneyardOpen,
    BoneyardClose,
    SectionHeadingLeader,
    SynopsisLeader,
    TitlePageKey,
    TitlePageValue,
    Italic,
    Bold,
    Underline,
    Text,
}
