import { Block, Run, RunStyle, MultilineType, MultilineStructure } from "./blocks";
import { Token, TokenType } from "./tokens";


export class MultilineManager {

    multilineStyles = new Map([
        [MultilineType.Boneyard, RunStyle.Boneyard],
        [MultilineType.Note, RunStyle.Note]
    ]);
    multilineTokens = new Set([
        TokenType.BoneyardOpen,
        TokenType.BoneyardClose,
        TokenType.NoteOpen,
        TokenType.NoteClose
    ]);
    multilineTypes = new Map([
        [TokenType.BoneyardOpen, MultilineType.Boneyard],
        [TokenType.BoneyardClose, MultilineType.Boneyard],
        [TokenType.NoteOpen, MultilineType.Note],
        [TokenType.NoteClose, MultilineType.Note],
    ]);
    openMultilines: Set<MultilineType> = new Set();
    openMultilineStarts = new Map();
    activeMultilines: MultilineStructure[] = [];

    reset() {
        this.openMultilines = new Set();
        this.openMultilineStarts = new Map();
    }

    manage(
        token: Token,
        blocks: Block[],
        runs: Run[],
        lineIndex: number,
        tokenIndex: number
    ) {
        const type = this.multilineTypes.get(token.type);
        if (typeof type === "undefined") return;

        if (this.isCloser(token) && this.openMultilines.has(type)) {
            this.closeMultiline(type, blocks, runs, lineIndex, tokenIndex);
        }
        if (this.isOpener(token) && !this.openMultilines.has(type)) {
            this.openMultiline(type, lineIndex, tokenIndex);
        }
    }

    isCloser(token: Token): boolean {
        return (token.type === TokenType.BoneyardClose ||
            token.type === TokenType.NoteClose);
    }

    isOpener(token: Token): boolean {
        return (token.type === TokenType.BoneyardOpen ||
            token.type === TokenType.NoteOpen);
    }

    openMultiline(type: MultilineType, lineIndex: number, tokenIndex: number) {
        this.openMultilines.add(type);
        if (!this.openMultilineStarts.has(type)) {
            this.openMultilineStarts.set(type, [lineIndex, tokenIndex + 1]);
        }
    }

    closeMultiline(
        type: MultilineType,
        blocks: Block[],
        runs: Run[],
        lineIndex: number,
        tokenIndex: number) {

        const [lineStart, tokenStart] = this.openMultilineStarts.get(type);
        const style = this.multilineStyles.get(type);
        if (typeof style === "undefined") return;
        
        // Process all lines in between start and current
        for (let i = lineStart + 1; i < lineIndex; i++) {
            for (let run of blocks[i].runs) {
                run.styles.add(style);
            }
        }

        // Process starting line from starting index to end
        const startLine = blocks[lineStart];
        startLine.runs[tokenStart - 1].styles.add(RunStyle.Special);
        for (let i = tokenStart; i < startLine.runs.length; i++) {
            startLine.runs[i].styles.add(style);
        }

        // Process current line to closing token index
        for (let i = 0; i < tokenIndex; i++) {
            runs[i].styles.add(style);
        }
        runs[tokenIndex].styles.add(RunStyle.Special);

        this.openMultilines.delete(style);
        this.openMultilineStarts.delete(style);
        this.activeMultilines.push(
            new MultilineStructure(
                type,
                lineStart,
                lineIndex
            )
        );
    }
}
