import { MultilineStructure, OpenMultilineStructure } from "./multiline";

export class Document {
    titlePage: Map<string, string>;
    blocks: Block[];
    activeMultilines: Set<MultilineStructure>;
    openMultilines: OpenMultilineStructure[];

    constructor(
        titlePage: Map<string, string>,
        blocks: Block[],
        activeMultilines: Set<MultilineStructure>,
        openMultilines: OpenMultilineStructure[]
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
    centered?: boolean;
    isDual?: boolean;

    constructor(type: BlockType, runs: Run[], centered?: boolean, isDual?: boolean) {
        this.type = type;
        this.runs = runs;
        if (centered) this.centered = centered;
        if (isDual) this.isDual = isDual;
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
    Bold,
    Italic,
    Underline,
    Boneyard,
    Note,
    SceneNumber,
    Special,
    TitlePageKey,
    TitlePageValue
}

