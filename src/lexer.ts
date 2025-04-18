import { Token, TokenType } from "./tokens";
import { Tokenizer } from "./tokenizer";

export class LexerOptions {

    isDocumentStart: boolean;
    isInDialogue: boolean;
    nextLineIsBlank: boolean;
    previousLineIsBlank: boolean;

    constructor(
        isDocumentStart: boolean,
        isInDialogue: boolean,
        nextLineIsBlank: boolean,
        previousLineIsBlank: boolean
    ) {
        this.isDocumentStart = isDocumentStart;
        this.isInDialogue = isInDialogue;
        this.nextLineIsBlank = nextLineIsBlank;
        this.previousLineIsBlank = previousLineIsBlank;
    }
}

export class Lexer {

    // Block-level flags
    isDocumentStart = false;
    isInDialogue = false;
    isInTitlePage = true;
    nextLineIsBlank = true;
    previousLineIsBlank = true;

    // Inline flags
    isEscaped = false;
    nextChar = "";

    textBuffer = "";
    tokenizer = new Tokenizer();

    lex(chunk: string, options: LexerOptions): Token[] {

        this.isDocumentStart = options.isDocumentStart;
        this.isInDialogue = options.isInDialogue;
        this.isInTitlePage = false;
        this.previousLineIsBlank = options.previousLineIsBlank;

        const lines = chunk.split("\n");
        const tokens = [];

        for (let i = 0; i < lines.length; i++) {
            if (i < lines.length - 1) {
                const nextLine = lines[i + 1];
                this.nextLineIsBlank = !nextLine;
            } else {
                this.nextLineIsBlank = options.nextLineIsBlank;
            }

            const token = this.tokenizer.tokenizeLine(lines[i], this);

            this.isDocumentStart = false;
            if (token.type === TokenType.BlankLine ||
                token.type === TokenType.PageBreak) {
                this.previousLineIsBlank = true;
                this.isInDialogue = false;
                this.isInTitlePage = false;
            } else if (token.type === TokenType.Character) {
                this.isInDialogue = true;
                this.previousLineIsBlank = false;
            } else {
                this.previousLineIsBlank = false;
            }
            
            tokens.push(token);
        }
        return tokens;
    }

    lexLine(line: string): Token[] {

        const tokens = [];

        for (let i = 0; i < line.length; i++) {
            if (i < line.length - 1) {
                this.nextChar = line[i + 1];
            } else {
                this.nextChar = "";
            }

            const token = this.tokenizer.tokenizeChar(line[i], this);

            // First, handle escape tokens or reset the escaped flag.
            if (token.type === TokenType.Escape) {
                this.isEscaped = true;
            } else {
                this.isEscaped = false;
            }

            // If the token is plain text, we start/continue building a text buffer.
            if (token.type === TokenType.Text) {
                this.textBuffer += token.content;
            } else {
                // Otherwise, we push and clear the text buffer.
                if (this.textBuffer.length > 0) {
                    tokens.push(new Token(
                        TokenType.Text,
                        this.textBuffer
                    ));
                    this.textBuffer = "";
                }

                // If we processed a two-character token, we skip the next character.
                if (token.content.length === 2) i++;

                tokens.push(token);
            }
        }
        if (this.textBuffer.length > 0) {
            tokens.push(new Token(
                TokenType.Text,
                this.textBuffer
            ));
            this.textBuffer = "";
        }
        return tokens;
    }
}
