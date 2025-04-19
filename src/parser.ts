import { Block, BlockType, Document, Run, RunStyle } from "./blocks";
import { Lexer, LexerOptions } from "./lexer";
import { MultilineManager } from "./multiline";
import { Stylizer } from "./stylizer";
import { BlockToken, BlockTokenType, RunToken, RunTokenType, StyleToken } from "./tokens";

export class ParserOptions {
    isDocumentStart: boolean;
    isInDialogue: boolean;
    isInDualDialogue: boolean;
    nextLineIsBlank: boolean;
    previousLineIsBlank: boolean;

    constructor(
        isDocumentStart?: boolean,
        isInDialogue?: boolean,
        isInDualDialogue?: boolean,
        nextLineIsBlank?: boolean,
        previousLineIsBlank?: boolean,
    ) {
        this.isDocumentStart = isDocumentStart ?? false;
        this.isInDialogue = isInDialogue ?? false;
        this.isInDualDialogue = isInDualDialogue ?? false;
        this.nextLineIsBlank = nextLineIsBlank ?? true;
        this.previousLineIsBlank = previousLineIsBlank ?? true;
    }
}

export class Parser {

    static typeMap = new Map([
        [BlockTokenType.BlankLine, BlockType.BlankLine],
        [BlockTokenType.SceneHeading, BlockType.SceneHeading],
        [BlockTokenType.Action, BlockType.Action],
        [BlockTokenType.Character, BlockType.Character],
        [BlockTokenType.Dialogue, BlockType.Dialogue],
        [BlockTokenType.Parenthetical, BlockType.Parenthetical],
        [BlockTokenType.Lyric, BlockType.Lyric],
        [BlockTokenType.Transition, BlockType.Transition],
        [BlockTokenType.PageBreak, BlockType.PageBreak],
        [BlockTokenType.SectionHeading, BlockType.SectionHeading],
        [BlockTokenType.Synopsis, BlockType.Synopsis],
        [BlockTokenType.TitlePage, BlockType.TitlePage]
    ]);

    lexer = new Lexer();
    mlManager = new MultilineManager();
    stylizer = new Stylizer(this.mlManager);
    activeStyles = new Set();
    isInDualDialogue = false;
    openTitlePageKey = "";
    openTitlePageValue: string[] = [];

    parse(chunk: string, options: ParserOptions): Document {
        const lexerOptions = new LexerOptions(
            options.isDocumentStart,
            options.isInDialogue,
            options.nextLineIsBlank,
            options.previousLineIsBlank
        );

        const tokens = this.lexer.lex(chunk, lexerOptions);

        const titlePage = new Map();
        const blocks = [];

        this.mlManager.reset();
        this.isInDualDialogue = options.isInDualDialogue;

        /* 
         * If we're at the start of the document, read the title page into a map.
         * Note that this doesn't do any inline parsing or read the tokens into
         * blocks; that happens in the main document parse. This just builds the
         * map for later reference.
         */
        if (options.isDocumentStart) {
            for (let [i, token] of tokens.entries()) {
                if (token.type === BlockTokenType.TitlePage) {
                    this.parseTitlePageBlock(token.content, titlePage);
                    this.mlManager.openTitlePage();
                } else {
                    if (this.mlManager.hasOpenTitlePage) {
                        this.mlManager.closeTitlePage(i);
                    }
                    break;
                }
            }
            /* 
             * If there are any open title page items left when we finish parsing,
             * we add them to the title page and close the open items.
             */
            if (this.openTitlePageKey) {
                titlePage.set(this.openTitlePageKey, this.openTitlePageValue.join("\n"));
                this.openTitlePageKey = "";
                this.openTitlePageValue = [];
            }
            if (this.mlManager.hasOpenTitlePage) {
                this.mlManager.closeTitlePage(tokens.length - 1);
            }
        }
        
        for (let [i, token] of tokens.entries()) {
            const blockType = Parser.typeMap.get(token.type) ?? BlockType.Action;
            if (blockType === BlockType.BlankLine) this.isInDualDialogue = false;

            /* 
             * Then all tokens (including title page tokens) are parsed for
             * inline styles and multiline structures.
             */
            const runs = this.parseBlock(token.content, i);

            blocks.push(new Block(
                blockType,
                runs,
                this.isInDualDialogue
            ));
        }

        return new Document(
            titlePage,
            blocks,
            this.mlManager.activeMultilines,
            this.mlManager.openMultilines
        );
    }

    parseBlock(tokens: RunToken[], lineIndex: number): Run[] {
        const runs = [];
        for (let [i, token] of tokens.entries()) {
            if (token.type === RunTokenType.DualDialogue) {
                this.isInDualDialogue = true;
            }
            if (
                token.type === RunTokenType.TitlePageValue &&
                Array.isArray(token.content)
            ) {
                return [...runs, ...this.parseBlock(token.content, lineIndex)]; 
            }
            if (token.isMultilineStyle()) this.mlManager.manage(token, lineIndex);
            const text = typeof token.content === "string" ? token.content : "";
            const styles = this.stylizer.stylize(token);
            runs.push(new Run(text, styles));
        }
        return runs;
    }

    parseTitlePageBlock(tokens: RunToken[], titlePage: Map<string, string>) {
        for (let token of tokens) {
            const text = typeof token.content === "string" ? token.content : "";
            if (token.type === RunTokenType.TitlePageKey) {
                if (this.openTitlePageKey && this.openTitlePageValue) {
                    titlePage.set(this.openTitlePageKey, this.openTitlePageValue.join("\n"));
                }
                this.openTitlePageKey = text;
                this.openTitlePageValue = [];
            } else if (token.type === RunTokenType.TitlePageValue) {
                const value = text;
                this.openTitlePageValue.push(value);
            }
        }
    }
}
