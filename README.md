# Fairfax

Fairfax is a TypeScript module for parsing Fountain screenplay markup.

For a working implementation, see [Monica](https://github.com/ogions/monica). For more on Fountain, see [the website](https://fountain.io/). 

## Usage

Fairfax can take any Fountain string as input and will return a `Document` object (see [Documents](#documents) below).

```typescript
import { Parser } from "fairfax"

const parser = new Parser();
const fountainDocument = parser.parse(myFountainString);
```

However, Fairfax is an incremental parser, meaning it's also capable of processing a single line of input at a time. Because Fountain is context-based, if we do this, then we also need to pass in a `ParserContext` with some extra information about the input.

```typescript
import { Parser, ParserContext } from "fairfax"

const parser = new Parser();
const context = new ParserContext(
    isDocumentStart,
    isInDialogue,
    isInDualDialogue,
    nextLineIsBlank,
    previousLineIsBlank
);

const fountainDocument = parser.parse(myPartialFountainString, context);
```
