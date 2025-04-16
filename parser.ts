import { Block, BlockType, Document, Run, RunStyle } from "./blocks";
import { Lexer, LexerOptions } from "./lexer";
import { Token, TokenType } from "./tokens";

export class ParserOptions {
    isInDialogue: boolean;
    nextLineIsBlank: boolean;
    previousLineIsBlank: boolean;
    includeMarkup: boolean;

    constructor(isInDialogue?: boolean, nextLineIsBlank?: boolean, previousLineIsBlank?: boolean, includeMarkup?: boolean) {
        this.isInDialogue = isInDialogue ?? false;
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
        [TokenType.Synopsis, BlockType.Synopsis]
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
    openStyles = new Set();
    openStyleStarts = new Map();

    parse(chunk: string, options: ParserOptions): Document {

        const lexerOptions = new LexerOptions(
            options.isInDialogue,
            options.nextLineIsBlank,
            options.previousLineIsBlank
        );
        const tokens = this.lexer.lex(chunk, lexerOptions);
        const blocks = [];
        for (let token of tokens) {
            const blockType = this.typeMap.get(token.type) ?? BlockType.Action;
            const runs = this.parseInnerTokens(token.content); 
            const block = new Block(blockType, runs);
            blocks.push(block);
            this.openStyles.clear();
            this.openStyleStarts.clear();
        }

        const titlePage = new Map();
        return new Document(titlePage, blocks);
    }

    parseInnerTokens(tokens: string | Token[]): Run[] {
        if (typeof tokens == "string") {
            return [new Run(tokens, new Set([]))]
        }
        let runs = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const text = typeof token.content === "string" ? token.content : "";
            const styles = this.getStylesFrom(token, i, runs);

            runs.push(new Run(text, styles));
        }
        let collapsedRuns = [];
        let currentRun = new Run("", new Set());
        for (let run of runs) {
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
        return collapsedRuns;
    }

    getStylesFrom(token: Token, tokenIndex: number, runs: Run[]): Set<RunStyle> {

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

        return this.handleStyle(token, tokenIndex, runs);
    }

    handleStyle(token: Token, tokenIndex: number, runs: Run[]): Set<RunStyle> {
        if (this.closerTokens.has(token.type)) {
            const style = this.styleMap.get(token.type);
            if (style && this.openStyles.has(style)) {
                this.closeStyle(style, tokenIndex, runs);
                return new Set([RunStyle.Special]);
            }
        }

        if (this.openerTokens.has(token.type)) {
            const style = this.styleMap.get(token.type);
            if (style) {
                this.openStyle(style, tokenIndex);
            }
        }
        return new Set();
    }

    openStyle(style: RunStyle, tokenIndex: number) {
        this.openStyles.add(style);
        if (!this.openStyleStarts.has(style)) {
            this.openStyleStarts.set(style, tokenIndex + 1);
        }
    }

    closeStyle(style: RunStyle, tokenIndex: number, runs: Run[]) {
        const startIndex = this.openStyleStarts.get(style);
        runs[startIndex - 1].styles.add(RunStyle.Special);

        for (let i = startIndex; i < tokenIndex; i++) {
            runs[i].styles.add(style);
        } 

        this.openStyles.delete(style);
        this.openStyleStarts.delete(style);
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
}
