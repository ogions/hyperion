import { Block, BlockType, Document, MultilineStructure, Run } from "./blocks";
import { Lexer, LexerOptions } from "./lexer";
import { MultilineManager } from "./multiline";
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
        this.isInTitlePage = isInTitlePage ?? false;
        this.nextLineIsBlank = nextLineIsBlank ?? true;
        this.previousLineIsBlank = previousLineIsBlank ?? true;
        this.includeMarkup = includeMarkup ?? false;
    }
}

export class Parser {

    lexer = new Lexer();
    mlManager = new MultilineManager();
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
    openKey = "";
    openValue: string[] = [];

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

            // Safeguard in case this token doesn't contain any inner tokens
            if (typeof token.content === "string") {
                blocks.push(
                    new Block(
                        blockType,
                        [new Run(token.content, new Set())]
                    )
                );
            } else {

                // Otherwise, we process title page tokens as key/value pairs
                if (blockType === BlockType.TitlePage) {
                    this.parseTitlePageTokens(token.content, titlePage);
                }

                /* Then all tokens (including title page tokens) are parsed for
                 * inline styles and multiline structures.
                 */
                const runs = this.parseInnerTokens(token.content, blocks, i);
                blocks.push(new Block(blockType, runs));
            }
        }

        /* If there are any open title page items left when we finish parsing,
         * we add them to the title page and close the open items.
         */
        if (this.openKey) {
            titlePage.set(this.openKey, this.openValue.join("\n"));
            this.openKey = "";
            this.openValue = [];
        }

        /* If there are any open multiline structures (that don't have a
         * beginning or end), then we track them as active structures
         * document before resetting the manager.
         */
        for (let type of this.mlManager.openMultilines) {
            const start = this.mlManager.openMultilineStarts.get(type);
            const multiline = new MultilineStructure(type, start);
            this.mlManager.activeMultilines.push(multiline);
        }

        this.mlManager.reset();

        return new Document(titlePage, blocks, this.mlManager.activeMultilines);
    }

    parseInnerTokens(tokens: Token[], blocks: Block[], lineIndex: number): Run[] {
        const runs = [];
        for (let [i, token] of tokens.entries()) {
            const text = typeof token.content === "string" ? token.content : "";

            /* UGLY. Right now stylizer returns style of closing token and the
             * rest are side effects, while multiline manager does everything
             * by mutating inputs. Standardize and refactor this.
             */
            const styles = this.stylizer.stylize(token, runs, i);
            runs.push(new Run(text, styles));
            if (this.mlManager.multilineTokens.has(token.type)) {
                this.mlManager.manage(token, blocks, runs, lineIndex, i);
            } 
        }
        this.stylizer.reset();
        return runs;
    }

    parseTitlePageTokens(tokens: Token[], titlePage: Map<string, string>) {
        for (let token of tokens) {
            const text = typeof token.content === "string" ? token.content : "";
            if (token.type === TokenType.TitlePageKey) {
                if (this.openKey && this.openValue) {
                    titlePage.set(this.openKey, this.openValue.join("\n"));
                }
                this.openKey = text;
                this.openValue = [];
            } else if (token.type === TokenType.TitlePageValue) {
                const value = text;
                this.openValue.push(value);
            }
        }
    }
}
