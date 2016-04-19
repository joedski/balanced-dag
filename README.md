Balanced Directed-Acyclic-Graph
===============================

> Note for Browser Peeps: This uses Map and Set, so shim those in if you need to.  Run an ES3 Reserved Word Safe-ifier Thing if you're supporting ancient (enterprise) browsers.

Given a Directed Acyclic Graph —or "digraph" if your _hip_ and _with it_— in the form of an adjacency list, add weight all the edges so that all paths from any source to any sink will have the same total weight of _1.0_.

The reason I wrote this was to calculate a consistent User Progress through a branching interaction.  I don't actually have a rigorous proof that this works for all graphs, but it's been working reasonably well for my needs.



Dependencies
------------

- [fraction.js](https://www.npmjs.com/package/fraction.js) is used to provide problem-free division.  Fraction values are provided in the output, though a decimal value is also provided for direct use.



API
---

### equalWeightGraph( adjacencyList, vertices? )

Type: `( Map<VertexId, Set<VertexId>>, Map<VertexId, Vertex> ) => { vertexProgresses: Map<VertexId, VertexProgress>, edgeWeights: Map<VertexId, Map<VertexId, Edge>> }`

Related Types:
- `VertexId = any` though you should probably stick to `Symbol`, `string`, and `number`.
- `Vertex = { progress?: boolean }`
	- `progress` indicates whether or not this vertex should contribute towards the user's progress through the branching interaction.
- `VertexProgress = { progress: number, progressFraction: Fraction }`
	- `progress` is a number in the range of `[0.0 1.0]` indicating the user's progress through the interaction.
	- `progressFraction` is a rational value used to calculate `progress`.
- `Edge = { weight: Fraction }`
	- `weight` The weight of this edge, which in this algorithm indicates by how much the user progresses when crossing this edge.

If `vertices` is not provided, a default Map is created internally.  You should only need to provide your own `vertices` if you're specifying certain vertices as not contributing to user progress, which might occur for certain instructions, result-display, or summary pages,

#### Example

Usual use case is this:

```js
let storyDag = daggifyMyStory( myStory );
let { vertexProgresses } = equalWeightGraph( storyDag );

// ...

const render = ({ props }) => {
	let stepProgress = vertexProgresses.get( props.step.id );

	return (
		h.( 'div', { 'class': 'interaction-progress' }, [
			`Progress: ${ Math.round( stepProgress.progress * 100 ) }%`
		])
	);
};
```



Caveats
-------

### Pure-zero-weight branches

The following topology may be problematic to progress reporting under certain conditions:

    a --> b --> c
     \_________/`

If c has `progress: false`, then this happens...

    a --> b -[0]-> c
     \________[0]_/`

This will cause `a --> b` to have different weights depending on what comes before a... For instance, if `a` has `progress: false`, then...

    -[0]-> a -[1]-> b -[0]-> c
            \___________[0]_/`

Where as if `a` has `progress: true`, then this happens

    -[1]-> a -[0]-> b -[0]-> c
            \___________[0]_/`

This arises due to `a` being able to skip straight to `c`.  To get around that, either don't skip straight to `c`, or add an additional vertex after `c`.

Basically, instead of this:

    OkayGo --> AndSecond --> ThatsAllFolks
          \_________________/`

What you _should_ do if you want `ThatsAllFolks` to be `progress: false` is either this:

    OkayGo --> AndSecond --> ThatsAllFolks
          \__> YouDoneGoofed _/`

Or this:

    OkayGo --> AndSecond --> WellWasntThatFun --> ThatsAllFolks
          \_________________/`
