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

### balancedDag( adjacencyList, vertexOptions? )

Type: `( Map<VertexId, Set<VertexId>>, Map<VertexId, VertexOptions> ) => { vertexProgresses: Map<VertexId, VertexInfo>, edgeWeights: Map<VertexId, Map<VertexId, EdgeInfo>> }`

Related Types:
- `VertexId = any` though you should probably stick to `Symbol`, `string`, and `number`.
- `VertexOptions = { progress?: boolean }`
	- `progress` indicates whether or not this vertex should contribute towards the user's progress through the branching interaction.
- `VertexInfo = { progress: number, progressFraction: Fraction }`
	- `progress` is a number in the range of `[0.0 1.0]` indicating the user's progress through the interaction.
	- `progressFraction` is a rational value used to calculate `progress`.
- `EdgeInfo = { weight: Fraction }`
	- `weight` The weight of this edge, which in this algorithm indicates by how much the user progresses when crossing this edge.

If `vertexOptions` is not provided, a default Map is created internally.  You should only need to provide your own `vertexOptions` if you're specifying certain vertices as not contributing to user progress, which might occur for certain instructions, result-display, or summary pages,

#### Example

Usual use case is this (in ES6):

```js
// During interaction initialization...

import balancedDag from 'balanced-dag';
let storyDag = daggifyMyStory( myStory );
let { vertexProgresses } = balancedDag( storyDag );

// some display component...

const render = ({ props, context }) => {
	let stepProgress = context.vertexProgresses.get( props.step.id );

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

### Ambiguities in Paths which Split and Rejoin Mid Way

Consider the following graph:

    Start --> Decide --> DoOneThing --> DoAnother --> WellThatWasFun --> Bye
      \           \                                   ^
       V           V                                 /
       OhOkay --> StillNo --------------------------'

The first thing that happens of course is the longest path gets weighted.

    Start -[1/5]-> Decide -[1/5]-> DoOneThing -[1/5]-> DoAnother -[1/5]-> WellThatWasFun -[1/5]-> Bye
      \               \                                                   ^
       V               V                                                 /
       OhOkay ------> StillNo ------------------------------------------'

There's now a problem, however.  Depending on if weighting starts at `Decide` or `OhOkay`, the remaining two paths in the graph will have different weights, but which way the weights are distributed cannot be known unless additional behavior is defined.

For instance, if the algorithm should prefer to first weight paths that have fewer weights already defined, we end up with this:

    Start -[1/5]-> Decide -[1/5]-> DoOneThing -[1/5]-> DoAnother -[1/5]-> WellThatWasFun -[1/5]-> Bye
      \                \                                                  ^
     [4/15]             \                                                /
        V                V                                              /
        OhOkay -[4/15]-> StillNo ---------------------[4/15]-----------'
    
    then
    
    Start -[1/5]-> Decide -[1/5]-> DoOneThing -[1/5]-> DoAnother -[1/5]-> WellThatWasFun -[1/5]-> Bye
      \                \                                                  ^
     [4/15]           [1/3]                                              /
        V                V                                              /
        OhOkay -[4/15]-> StillNo ---------------------[4/15]-----------'

But if you take instead the paths which have the most weighted first, you end up with this:

    Start -[1/5]-> Decide -[1/5]-> DoOneThing -[1/5]-> DoAnother -[1/5]-> WellThatWasFun -[1/5]-> Bye
      \                \                                                  ^
       \              [3/10]                                             /
        V                V                                              /
        OhOkay --------> StillNo ---------------------[3/10]-----------'
    
    then
    
    Start -[1/5]-> Decide -[1/5]-> DoOneThing -[1/5]-> DoAnother -[1/5]-> WellThatWasFun -[1/5]-> Bye
      \                \                                                  ^
     [1/4]            [3/10]                                             /
        V                V                                              /
        OhOkay -[1/4]-> StillNo ---------------------[3/10]------------'

While the values derived either way are somewhat close, they're still different, certainly enough that without a defined order in Map and Set, the algorithm would not be stable over a given set.  Ideally, the algorithm is stable regardless of whether or not the implementation of any unordered collection type actually has a hidden order, so to cope with this the algorithm here has switchable behavior defined here:
- The default, which is to prefer to operate first on paths whose edges have fewer weights already assigned
- To prefer to operate first on paths whose edges have more weights already assigned

The choice of which behavior to use is arbitrary.

Note that while there may be cases where there are a number of paths with the same number of unweighted edges, the order there is unimportant since the weight remainder would always end up divided across the same number of unweighted edges, so sorting by the number of unweighted edges once before weighting each path of a certain length is sufficient to disambiguate things here.
