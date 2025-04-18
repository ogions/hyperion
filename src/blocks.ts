export class Document {
    titlePage: Map<string, string>;
    blocks: Block[];
    activeMultilines: Set<MultilineStructure>;
    openMultilines: MultilineStructure[];

    constructor(
        titlePage: Map<string, string>,
        blocks: Block[],
        activeMultilines: Set<MultilineStructure>,
        openMultilines: MultilineStructure[]
    ) {
        this.titlePage = titlePage;
        this.blocks = blocks;
        this.activeMultilines = activeMultilines;
        this.openMultilines = openMultilines;
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

export class MultilineStructure {
    type: MultilineType;
    startLine: number | undefined;
    startToken: number | undefined;
    endLine: number | undefined;
    endToken: number | undefined;

    constructor(type: MultilineType, start?: number, startToken?: number, endLine?: number, endToken?: number) {
        this.type = type;
        this.startLine = start;
        this.startToken = startToken;
        this.endLine = endLine;
        this.endToken = endToken;
    }
}

export enum MultilineType {
    Boneyard,
    Note
}
