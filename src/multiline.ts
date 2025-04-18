import { Block, Run, RunStyle } from "./blocks";
import { Token, TokenType } from "./tokens";

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
    Note,
    TitlePage
}

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
    openMultilines: MultilineStructure[] = [];
    activeMultilines: Set<MultilineStructure> = new Set();
    hasOpenTitlePage = false;

    reset() {
        this.openMultilines = [];
        this.activeMultilines = new Set();
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

        if (this.isCloser(token)) {
            /* We look back over the stack of open multilines and close the
             * first one with a matching type.
             */
            for (let i = this.openMultilines.length - 1; i >= 0; i--) {
                const multiline = this.openMultilines[i];
                if (type === multiline.type) {
                    this.closeMultiline(multiline, i, blocks, runs, lineIndex, tokenIndex);
                    return;
                }
            }

            // If we didn't find a match, then we open the closer.
            this.openMultiline(type, undefined, undefined, lineIndex, tokenIndex);
        }
        if (this.isOpener(token)) {
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

    openMultiline(type: MultilineType, startLine?: number, startToken?: number, endLine?: number, endToken?: number) {
        if (typeof startLine !== "undefined" && typeof startToken !== "undefined") {
            this.openMultilines.push(new MultilineStructure(
                type,
                startLine,
                startToken + 1
            ));
        }
        if (typeof endLine !== "undefined" && typeof endToken !== "undefined") {
            this.openMultilines.push(new MultilineStructure(
                type,
                undefined,
                undefined,
                endLine,
                endToken - 1
            ))
        }
    }

    closeMultiline(
        multiline: MultilineStructure,
        multilineIndex: number,
        blocks: Block[],
        runs: Run[],
        lineIndex: number,
        tokenIndex: number
    ) {
        const style = this.multilineStyles.get(multiline.type);
        const startLineIndex = (typeof multiline.startLine === "undefined") ? lineIndex : multiline.startLine;
        const tokenStartIndex = (typeof multiline.startToken === "undefined") ? tokenIndex : multiline.startToken;
        const endLineIndex = (typeof multiline.endLine === "undefined") ? lineIndex : multiline.endLine;
        const tokenEndIndex = (typeof multiline.endToken === "undefined") ? tokenIndex : multiline.endToken;
        if (typeof style === "undefined") return;

        // Process all lines in between start and current
        for (let i = startLineIndex + 1; i < endLineIndex; i++) {
            for (let run of blocks[i].runs) {
                run.styles.add(style);
            }
        }

        // Process starting line from starting index to end
        if (startLineIndex < endLineIndex) {
            const startLine = blocks[startLineIndex];
            startLine.runs[tokenStartIndex - 1].styles.add(RunStyle.Special);
            for (let i = tokenStartIndex; i < startLine.runs.length; i++) {
                startLine.runs[i].styles.add(style);
            }
        }

        // Process current line to closing token index
        for (let i = 0; i < tokenEndIndex; i++) {
            runs[i].styles.add(style);
        }
        runs[tokenEndIndex].styles.add(RunStyle.Special);

        /* Add the end point to the multiline object, remove it from the open
         * tracker, and add it to the active tracker.
         */
        multiline.endLine = endLineIndex;
        this.openMultilines.splice(multilineIndex, 1);
        this.activeMultilines.add(multiline);
    }

    openTitlePage() {
        this.hasOpenTitlePage = true;
        console.log("Title page open")
    }

    closeTitlePage(index: number) {
        console.log("Titel page closed")
        this.hasOpenTitlePage = false;
        this.activeMultilines.add(new MultilineStructure(
            MultilineType.TitlePage,
            0,
            undefined,
            index + 1
        ));
    }


}
