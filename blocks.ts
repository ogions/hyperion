export class Document {
    titlePage: Map<string, string>;
    body: Block[];

    constructor(titlePage: Map<string, string>, body: Block[]) {
        this.titlePage = titlePage;
        this.body = body;
    }
}

export class Block {
    type: BlockType;
    runs: Run[];

    constructor(type: BlockType, runs: Run[]) {
        this.type = type;
        this.runs = runs;
    }
}

export enum BlockType {
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
    Synopsis
}

export class Run {
    text: string;
    styles: Set<RunStyle>;

    constructor(text: string, styles: Set<RunStyle>) {
        this.text = text;
        this.styles = styles;
    }
}

export enum RunStyle {
    Centered,
    Bold,
    Italic,
    Underline,
    Boneyard,
    Note,
    Special
}
