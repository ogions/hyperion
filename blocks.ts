export class Document {
    titlePage: Map<string, string>;
    blocks: Block[];

    constructor(titlePage: Map<string, string>, blocks: Block[]) {
        this.titlePage = titlePage;
        this.blocks = blocks;
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
    Synopsis,
    TitlePage
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
    Special,
    TitlePage
}
