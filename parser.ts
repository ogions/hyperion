import { Block, BlockType, Document, Run, RunStyle } from "./blocks";
import { Lexer, LexerOptions } from "./lexer";
import { Token, TokenType } from "./tokens";

export class ParserOptions {
    isInDialogue: boolean;
    isInTitlePage: boolean;
    nextLineIsBlank: boolean;
    previousLineIsBlank: boolean;
    includeMarkup: boolean;

    constructor(
        isInDialogue?: boolean,
        isInTitlePage?: boolean,
        nextLineIsBlank?: boolean,
        previousLineIsBlank?: boolean,
        includeMarkup?: boolean
    ) {
        this.isInDialogue = isInDialogue ?? false;
        this.isInTitlePage = isInTitlePage ?? true;
        this.nextLineIsBlank = nextLineIsBlank ?? true;
        this.previousLineIsBlank = previousLineIsBlank ?? true;
        this.includeMarkup = includeMarkup ?? false;
    }
}

export class Parser {

    lexer = new Lexer();
    typeMap = new Map([
        [TokenType.BlankLine, BlockType.BlankLine],
        [TokenType.SceneHeading, BlockType.SceneHeading],
        [TokenType.Action, BlockType.Action],
        [TokenType.Character, BlockType.Character],
        [TokenType.Dialogue, BlockType.Dialogue],
        [TokenType.Parenthetical, BlockType.Parenthetical],
        [TokenType.Lyric, BlockType.Lyric],
        [TokenType.Transition, BlockType.Transition],
        [TokenType.PageBreak, BlockType.PageBreak],
        [TokenType.SectionHeading, BlockType.SectionHeading],
        [TokenType.Synopsis, BlockType.Synopsis],
        [TokenType.TitlePage, BlockType.TitlePage]
    ]);
    styleMap = new Map([
        [TokenType.CenterLeft, RunStyle.Centered],
        [TokenType.CenterRight, RunStyle.Centered],
        [TokenType.Bold, RunStyle.Bold],
        [TokenType.Italic, RunStyle.Italic],
        [TokenType.Underline, RunStyle.Underline],
        [TokenType.BoneyardOpen, RunStyle.Boneyard],
        [TokenType.BoneyardClose, RunStyle.Boneyard],
        [TokenType.NoteOpen, RunStyle.Note],
        [TokenType.NoteClose, RunStyle.Note]
    ]);
    closerTokens = new Set([
        TokenType.CenterRight,
        TokenType.Bold,
        TokenType.Italic,
        TokenType.Underline,
        TokenType.BoneyardClose,
        TokenType.NoteClose
    ]);
    openerTokens = new Set([
        TokenType.CenterLeft,
        TokenType.Bold,
        TokenType.Italic,
        TokenType.Underline,
        TokenType.BoneyardOpen,
        TokenType.NoteOpen
    ]);
    openKey = "";
    openValue: string[] = [];
    openStyles = new Set();
    openStyleStarts = new Map();
    openMultilines = new Set();
    openMultilineStarts = new Map();

    parse(chunk: string, options: ParserOptions): Document {

        const lexerOptions = new LexerOptions(
            options.isInDialogue,
            options.isInTitlePage,
            options.nextLineIsBlank,
            options.previousLineIsBlank
        );
        const tokens = this.lexer.lex(chunk, lexerOptions);
        const blocks = [];
        const titlePage = new Map();
        for (let [i, token] of tokens.entries()) {
            const blockType = this.typeMap.get(token.type) ?? BlockType.Action;


            // Safeguard in case the token doesn't contain any inner tokens
            const runs: Run[] = typeof token.content === "object" ?
                this.parseInnerTokens(token.content, titlePage, blocks, i) :
                [new Run(token.content, new Set([]))]; 

            blocks.push(new Block(blockType, runs));

            /* We need to clear any open styles that are limited to a single line
             * (centered, bold, italic, and underline). However, boneyards and
             * notes can span multiple lines, so those are saved separately.
             */
            if (this.openStyles.has(RunStyle.Boneyard)) {
                this.openMultilines.add(RunStyle.Boneyard);
                this.openMultilineStarts.set(
                    RunStyle.Boneyard,
                    [i, this.openStyleStarts.get(RunStyle.Boneyard)]
                );
            }
            if (this.openStyles.has(RunStyle.Note)) {
                this.openMultilines.add(RunStyle.Note);
                this.openMultilineStarts.set(
                    RunStyle.Note,
                    [i, this.openStyleStarts.get(RunStyle.Note)]
                );
            }
            this.openStyles.clear();
            this.openStyleStarts.clear();
        }
        this.openMultilines.clear();
        this.openMultilineStarts.clear();

        /* If there are any open title page items left when we finish parsing,
         * we add them to the title page and close the open items.
         */
        if (this.openKey) {
            titlePage.set(this.openKey, this.openValue.join("\n"));
            this.openKey = "";
            this.openValue = [];
        }

        for (let block of blocks) {
            this.collapseRuns(block);
        }

        return new Document(titlePage, blocks);
    }

    parseInnerTokens(tokens: Token[], titlePage: Map<string, string>, blocks: Block[], lineIndex: number): Run[] {
        let runs = [];
        for (let [i, token] of tokens.entries()) {
            const text = typeof token.content === "string" ? token.content : "";
            const styles = this.getStylesFrom(token, blocks, runs, lineIndex, i);
            if (token.type === TokenType.TitlePageKey || token.type === TokenType.TitlePageValue) {
                this.handleTitlePageToken(token, titlePage);
            }
            runs.push(new Run(text, styles));
        }
        return runs;
    }

    collapseRuns(block: Block) {
        let collapsedRuns = [];
        let currentRun = new Run("", new Set());
        for (let run of block.runs) {
            if (currentRun.text &&
                !this.stylesMatch(currentRun, run)) {

                collapsedRuns.push(currentRun);
                currentRun = run;
            } else {
                currentRun.text += run.text;
                currentRun.styles = run.styles;
            }
        }
        collapsedRuns.push(currentRun);
        block.runs = collapsedRuns;
    }

    getStylesFrom(token: Token, blocks: Block[], runs: Run[], lineIndex: number, tokenIndex: number): Set<RunStyle> {

        // One-off tokens can just be returned as special runs.
        if (token.type === TokenType.SceneHeadingForce ||
            token.type === TokenType.SceneNumberFence ||
            token.type === TokenType.ActionForce ||
            token.type === TokenType.CharacterForce ||
            token.type === TokenType.LyricLeader ||
            token.type === TokenType.TransitionForce ||
            token.type === TokenType.SectionHeadingLeader ||
            token.type === TokenType.SynopsisLeader) {

            return new Set([RunStyle.Special]);
        }

        if (token.type === TokenType.Text) {
            return new Set();
        }

        // All other non-text tokens need to be checked for pairs.
        return this.handleStyle(token, blocks, runs, lineIndex, tokenIndex);
    }

    handleStyle(token: Token, blocks: Block[], runs: Run[], lineIndex: number, tokenIndex: number): Set<RunStyle> {

        /* Check if the token closes an open style. We need to make sure that
         * the token is a potential closer and that the style it closes has
         * already been opened.
         */
        if (this.closerTokens.has(token.type)) {
            const style = this.styleMap.get(token.type);
            if (typeof style !== "undefined") {
                if (this.openMultilines.has(style)) {
                    this.closeMultiline(style, blocks, runs, lineIndex, tokenIndex);
                    return new Set([RunStyle.Special]);
                } else if (this.openStyles.has(style)) {
                    this.closeStyle(style, runs, tokenIndex);
                    return new Set([RunStyle.Special]);
                }
            }
        }

        // Otherwise, as long as the token is an opener, we open a new style.
        if (this.openerTokens.has(token.type)) {
            const style = this.styleMap.get(token.type);
            if (typeof style !== "undefined") {
                this.openStyle(style, tokenIndex);
            }
        }

        /* Open tokens are not given a special style, since we don't yet know if
         * they will be closed. The special style is assigned later when the run
         * is closed.
         */
        return new Set();
    }

    openStyle(style: RunStyle, tokenIndex: number) {
        this.openStyles.add(style);
        if (!this.openStyleStarts.has(style)) {
            this.openStyleStarts.set(style, tokenIndex + 1);
        }
    }

    closeStyle(style: RunStyle, runs: Run[], tokenIndex: number) {
        const startIndex = this.openStyleStarts.get(style);
        runs[startIndex - 1].styles.add(RunStyle.Special);

        for (let i = startIndex; i < tokenIndex; i++) {
            runs[i].styles.add(style);
        } 

        this.openStyles.delete(style);
    }

    closeMultiline(style: RunStyle, blocks: Block[], runs: Run[], lineIndex: number, tokenIndex: number) {

        // Process all lines in between start and current
        const [lineStart, charStart] = this.openMultilineStarts.get(style);
        for (let i = lineStart + 1; i < lineIndex; i++) {
            for (let run of blocks[i].runs) {
                run.styles.add(style);
            }
        }

        // Process starting line from starting index to end
        const startLine = blocks[lineStart];
        startLine.runs[charStart - 1].styles.add(RunStyle.Special);
        for (let i = charStart; i < startLine.runs.length; i++) {
            startLine.runs[i].styles.add(style);
        }

        // Process current line to closing token index
        for (let i = 0; i < tokenIndex; i++) {
            runs[i].styles.add(style);
        }

        this.openMultilines.delete(style);
    }

    stylesMatch(a: Run, b: Run): boolean {
        for (let style of a.styles) {
            if (!b.styles.has(style)) return false;
        }
        for (let style of b.styles) {
            if (!a.styles.has(style)) return false;
        }
        return true;
    }

    handleTitlePageToken(token: Token, titlePage: Map<string, string>) {
        if (token.type === TokenType.TitlePageKey) {
            if (this.openKey && this.openValue) {
                titlePage.set(this.openKey, this.openValue.join("\n"));
            }
            this.openKey = typeof token.content === "string" ? token.content : "";
            this.openValue = [];
        } else if (token.type === TokenType.TitlePageValue) {
            const value = typeof token.content === "string" ? token.content : "";
            this.openValue.push(value);
        }
    }
}
