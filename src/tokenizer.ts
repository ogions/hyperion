import { Lexer } from "./lexer";
import { FountainRegexes } from "./regexes";
import { BlockToken, BlockTokenType, RunToken, RunTokenType, StyleToken } from "./tokens";

export class Tokenizer {
    static regexes = new FountainRegexes();

    tokenizeLine(line: string, lexer: Lexer): BlockToken {

        /*
         * Rules are derived from the official Fountain spec at https://fountain.io/syntax/.
         * I've noted any variations where they occurred, usually because the spec is vague
         * and/or canonical implementations (the Fountain Github repo or Highland) disagree.
         * When in doubt, I try to be permissive, so the parser doesn't feel too pedantic.
         *
         * Official Spec: https://fountain.io/syntax/
         * Github Repo: https://github.com/nyousefi/Fountain/
         */
        
        // Blank line
        if (!line) {
            return new BlockToken(
                BlockTokenType.BlankLine,
                []
            );
        }

        /*
         * You create a Lyric by starting with a line with a tilde ~.
         * Fountain will remove the '~' and leave it up to the app to style the Lyric appropriately.
         * Lyrics are always forced. There is no "automatic" way to get them.
         */
        if (line.startsWith("~")) {
            const tokens = [
                new RunToken(
                    RunTokenType.LyricLeader,
                    "~"
                ),
                ...lexer.lexLine(line.slice(1))
            ];
            return new BlockToken(
                BlockTokenType.Lyric,
                tokens
            );
        }

        /*
         * You can force an Action element can by preceding it with an
         * exclamation point !.

         * This is helpful when Action is in uppercase and directly followed by
         * another line of Action, preventing the two from being interpreted a
         * Character and Dialogue elements.
         */
        if (line.startsWith("!")) {
            const tokens = [
                new RunToken(
                    RunTokenType.ActionForce,
                    "!"
                ),
                ...lexer.lexLine(line.slice(1))
            ];
            return new BlockToken(
                BlockTokenType.Action,
                tokens
            );
        }

        /*
         * You can force a Character element by preceding it with the “at” symbol @.
         *
         * The ability to force a Character element is helpful for names that require lower-case letters,
         * and for non-Roman languages.
         */
        if (line.startsWith("@")) {
            const tokens = [
                new RunToken(
                    RunTokenType.CharacterForce,
                    "@"
                ),
                ...lexer.lexLine(line.slice(1))
            ];
            return new BlockToken(
                BlockTokenType.Character,
                tokens
            );
        }

        /*
         * You can force any line to be a transition by beginning it with a greater-than symbol >.
         *
         * Centered text constitutes an Action element, and is bracketed with greater/less-than:
         * >THE END<
         * Leading spaces are usually preserved in Action, but not for centered text,
         * so you can add spaces between the text and the >< if you like.
         */
        if (line.startsWith(">")) {
            if (line.endsWith("<")) {
                const tokens = [
                    new RunToken(
                        RunTokenType.CenterLeft,
                        ">"
                    ),
                    ...lexer.lexLine(line.slice(1, -1)),
                    new RunToken(
                        RunTokenType.CenterRight,
                        "<"
                    )
                ];
                return new BlockToken(
                    BlockTokenType.Action,
                    tokens,
                    true
                );
            }

            const tokens = [
                new RunToken(
                    RunTokenType.TransitionForce,
                    ">"
                ),
                ...lexer.lexLine(line.slice(1))
            ];
            return new BlockToken(
                BlockTokenType.Transition,
                tokens
            );
        }

        /*
         * Page Breaks are indicated by a line containing three or more
         * consecutive equals signs, and nothing more.
         */
        if (Tokenizer.regexes.pageBreak.test(line)) {
            return new BlockToken(
                BlockTokenType.PageBreak,
                [new RunToken(
                    RunTokenType.Text,
                    line
                )]
            );
        }

        /*
         * Synopses are optional blocks of text to describe a Section or scene.
         * Synopses are single lines prefixed by an equals sign =.
         * They can be located anywhere within the screenplay.
         */
        if (line.startsWith("=")) {
            const tokens = [
                new RunToken(
                    RunTokenType.SynopsisLeader,
                    "="
                ),
                ...lexer.lexLine(line.slice(1))
            ];
            return new BlockToken(
                BlockTokenType.Synopsis,
                tokens
            );
        }

        /*
         * Sections are optional markers for managing the structure of a story.
         * Some screenplay applications use these like nested folders in a navigation view.
         * Create a Section by preceding a line with one or more pound-sign # characters.
         * You can nest Sections by adding more # characters.
         */
        if (Tokenizer.regexes.sectionHeading.test(line)) {
            const result = Tokenizer.regexes.sectionHeading.exec(line);
            const leader = result ? result[1] : "";
            const tokens = [
                new RunToken(
                    RunTokenType.SectionHeadingLeader,
                    leader
                ),
                ...lexer.lexLine(line.slice(leader.length))
            ];
            return new BlockToken(
                BlockTokenType.SectionHeading,
                tokens
            );
        }

        /*
         * A Scene Heading is any line that has a blank line following it,
         * and either begins with INT or EXT or similar (full list below).
         * A line beginning with any of the following, followed by either a dot or a space,
         * is considered a Scene Heading (unless the line is preceded by an exclamation point !).
         * Case insensitive.
         * INT, EXT, EST, INT/EXT, I/E
         * A Scene Heading always has at least one blank line preceding it.
         *
         * You can “force” a Scene Heading by starting the line with a single period.
         * Note that only a single leading period followed by an alphanumeric character
         * will force a Scene Heading. This allows the writer to begin Action and Dialogue elements
         * with ellipses without worry that they’ll be interpreted as Scene Headings.
         */
        if (Tokenizer.regexes.forcedSceneHeading.test(line) ||
            (lexer.previousLineIsBlank &&
            lexer.nextLineIsBlank &&
            Tokenizer.regexes.sceneHeading.test(line))) {

            const result = Tokenizer.regexes.sceneNumber.exec(line);
            const sceneNumber = result ? result[1] : "";
            const endIndex = sceneNumber ? line.length - sceneNumber.length - 2 : line.length;
            const startIndex = line.startsWith(".") ? 1 : 0;

            const sceneNumberTokens = sceneNumber ?
                [
                    new RunToken(
                        RunTokenType.SceneNumberFence,
                        "#"
                    ),
                    new RunToken(
                        RunTokenType.SceneNumber,
                        sceneNumber
                    ),
                    new RunToken(
                        RunTokenType.SceneNumberFence,
                        "#"
                    )
                ] :
                [];

            if (startIndex === 1) {
                const tokens = [
                    new RunToken(
                        RunTokenType.SceneHeadingForce,
                        "."
                    ),
                    ...lexer.lexLine(line.slice(startIndex, endIndex)),
                    ...sceneNumberTokens
                ];
                return new BlockToken(
                    BlockTokenType.SceneHeading,
                    tokens
                );
            } else {
                const tokens = [
                    ...lexer.lexLine(line.slice(startIndex,endIndex)),
                    ...sceneNumberTokens
                ];
                return new BlockToken(
                    BlockTokenType.SceneHeading,
                    tokens
                );
            }
        }

        /*
         * The requirements for Transition elements are:
         *   - Uppercase
         *   - Preceded by and followed by an empty line
         *   - Ending in TO:
         *
         * The Fountain implementation on Github provides exceptions for
         * "FADE OUT.", "CUT TO BLACK.", and "FADE TO BLACK."
         */
        if (lexer.previousLineIsBlank &&
            lexer.nextLineIsBlank &&
            Tokenizer.regexes.transition.test(line)) {

            return new BlockToken(
                BlockTokenType.Transition,
                lexer.lexLine(line)
            );
        }

         /*
         * A Character element is any line entirely in uppercase, with one empty line
         * before it and without an empty line after it.
         * "Character Extensions" – the parenthetical notations that follow
         * a character name on the same line – may be in uppercase or lowercase.
         * Character names must include at least one alphabetical character.
         * "R2D2" works, but "23" does not.
         */
        if (lexer.previousLineIsBlank &&
            !lexer.nextLineIsBlank &&
            Tokenizer.regexes.character.test(line)) {

            /*
             * Dual, or simultaneous, dialogue is expressed by adding a caret ^
             * after the second Character element.
             * Any number of spaces between the Character name and the caret are acceptable,
             * and will be ignored. All that matters is that
             * the caret is the last character on the line.
             */
            if (line.endsWith("^")) {
                const tokens = [
                    ...lexer.lexLine(line.slice(0, -1)),
                    new RunToken(
                        RunTokenType.DualDialogue,
                        "^"
                    )
                ];
                return new BlockToken(
                    BlockTokenType.Character,
                    tokens
                );
            }

            return new BlockToken(
                BlockTokenType.Character,
                lexer.lexLine(line)
            );
        }

        /*
         * Dialogue is any text following a Character or Parenthetical element.
         * Parentheticals follow a Character or Dialogue element,
         * and are wrapped in parentheses ().
         * If you want to do the unconventional thing of leaving white space in dialogue,
         * you would need to type two spaces on your “blank” line.
         */
        if (lexer.isInDialogue) {
            if (Tokenizer.regexes.parenthetical.test(line)) {
                return new BlockToken(
                    BlockTokenType.Parenthetical,
                    lexer.lexLine(line)
                );
            }

            return new BlockToken(
                BlockTokenType.Dialogue,
                lexer.lexLine(line)
            );
        }

        /*
         * If this would normally be classified as action, but could be a
         * character, mark it as such.
         */
        if (lexer.anticipateCharacter &&
            lexer.previousLineIsBlank &&
            Tokenizer.regexes.character.test(line)) {
            
            return new BlockToken(
                BlockTokenType.Character,
                lexer.lexLine(line),
                false,
                true
            );
        }
            
        // Fall back on action
        return new BlockToken(
            BlockTokenType.Action,
            lexer.lexLine(line)
        );
    }

    tokenizeTitlePage(line: string, lexer: Lexer): BlockToken {
        /*
         * The optional Title Page is always the first thing in a Fountain document.
         * Information is encoding in the format key: value. Keys can have spaces
         * (e. g. "Draft date"), but must end with a colon.
         *
         * Values can be inline with the key or they can be indented on a newline
         * below the key. Indenting is 3 or more spaces, or a tab. The indenting
         * pattern allows multiple values for the same key (multiple authors,
         * multiple address lines).
         */

        // Blank line
        if (!line) {
            return new BlockToken(
                BlockTokenType.BlankLine,
                []
            );
        }

        if (Tokenizer.regexes.titlePageKey.test(line)) {
            const matches = Tokenizer.regexes.titlePageKey.exec(line);
            const key = matches ? matches[1] : "";
            const space = matches ? matches[2] : "";
            const value = matches ? matches[3] : "";

            const tokens = [
                new RunToken(
                    RunTokenType.TitlePageKey,
                    key
                ),
                new RunToken (
                    RunTokenType.Text,
                    space
                )
            ];

            if (value) {
                tokens.push(new RunToken(
                    RunTokenType.TitlePageValue,
                    lexer.lexLine(value)
                ));
            }

            return new BlockToken(
                BlockTokenType.TitlePage,
                tokens
            );
        } else {
            const matches = Tokenizer.regexes.titlePageIndentedValue.exec(line);
            if (matches) {
                const space = matches[1];
                const value = matches[2];

                const tokens = [
                    new RunToken(
                        RunTokenType.Text,
                        space
                    ),
                    new RunToken(
                        RunTokenType.TitlePageValue,
                        lexer.lexLine(value)
                    )
                ];

                return new BlockToken(
                    BlockTokenType.TitlePage,
                    tokens
                );
            }
        }
        return new BlockToken(
            BlockTokenType.TitlePage,
            lexer.lexLine(line)
        );
    }

    tokenizeChar(char: string, lexer: Lexer): RunToken {
        
        // If the character is escaped, we ignore it.
        if (lexer.isEscaped) {
            return new RunToken(
                RunTokenType.Text,
                char
            )
        }

        // Check for two-character patterns first.
        if (lexer.nextChar === "*") {
            if (char === "/") {
                return new StyleToken(
                    RunTokenType.BoneyardOpen,
                    "/*"
                );
            }
            if (char === "*") {
                return new StyleToken(
                    RunTokenType.Bold,
                    "**"
                );
            }
        }
        if (char === "*" && lexer.nextChar === "/") {
            return new StyleToken(
                RunTokenType.BoneyardClose,
                "*/"
            );
        }
        if (char === "[" && lexer.nextChar === "[") {
            return new StyleToken(
                RunTokenType.NoteOpen,
                "[["
            );
        }
        if (char === "]" && lexer.nextChar === "]") {
            return new StyleToken(
                RunTokenType.NoteClose,
                "]]"
            );
        }

        // Next we can check for single-character patterns.
        if (char === "*") {
            return new StyleToken(
                RunTokenType.Italic,
                "*"
            );
        }
        if (char === "_") {
            return new StyleToken(
                RunTokenType.Underline,
                "_"
            );
        }
        if (char === "\\") {
            return new RunToken(
                RunTokenType.Escape,
                "\\"
            );
        }

        // Fall back on plain text
        return new RunToken(
            RunTokenType.Text,
            char
        )
    }

}
