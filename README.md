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

However, Fairfax is an incremental parser, meaning it's also capable of processing a single line of input at an arbitrary position in the screenplay. Because Fountain is context-based, if we do this, then we also need to pass in a `ParserContext` with some extra information about the input.

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

## Documents

Fairfax returns a `Document` object, which contains a few other elements that define a Fountain screenplay.

* `Document.titlePage` is a `Map` object of key/value pairs from the screenplay's title page. Note that this isn't the actual text of the title page, which is still contained in the document blocks, but a set of already-paired values for easy reference.
* `Document.blocks` is an array of `Block` objects (see [Blocks](#blocks) below) that represents the full parsed content of the input.
* `Document.activeMultilines` and `Document.openMultilines` are collections of `MultilineStructures` (see [Multilines](#multilines) below). These allow an editor to handle multiline comments that might extend beyond the parsed section.

### Blocks

A `Block` has a type (like Action, Dialogue, or Transition) and some `Run`s. Each `Run` contains some raw text and a set of `RunStyle`s which define how the text should be displayed. See the following example.

```
DAN
Let's retire them.
_Permanently_.
```

```typescript
blocks: [
    {
        type: Character,
        runs: [ { text: "DAN", styles: [] } ]
    },
    {
        type: Dialogue,
        runs: [ { text: "Let's retire them.", styles: [] } ]
    },
    {
        type: Dialogue,
        runs: [
            { text: "_", styles: [Special] },
            { text: "Permanently", styles: [Underline] },
            { text: "_", styles: [Special] },
            { text: ".", styles: [] }
        ]
    }
]
```
