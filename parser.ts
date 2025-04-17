import { Block, BlockType, Document, Run, RunStyle } from "./blocks";
import { Lexer, LexerOptions } from "./lexer";
import { Stylizer } from "./stylizer";
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
    stylizer = new Stylizer();
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
    multilineStyles = new Set([
        RunStyle.Boneyard,
        RunStyle.Note,
    ])
    openKey = "";
    openValue: string[] = [];
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
            this.stylizer.reset();

            /* We need to clear any open styles that are limited to a single line
             * (centered, bold, italic, and underline). However, boneyards and
             * notes can span multiple lines, so those are saved separately.
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
            */
        }
    /*
        this.openMultilines.clear();
        this.openMultilineStarts.clear();
        */

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
            const styles = this.stylizer.stylize(token, runs, i);
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
