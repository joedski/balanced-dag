'use strict';
/**
- Find all Source Nodes and Sink Nodes.
- Add Artificial Start and End Nodes:
    - The Artificial Start Node is added such that it has Next Edges to each of the Source Nodes of the original DAG
    - The Artificial End Node is added such that it has Previous Edges to each of the Drain Nodes of the original DAG
- Find All Paths from the Artificial Start Node to the Artificial End Node
- Sort Paths by their Count of Edges.
- The Weight Basis Value is 1.
- For each Path, from Greatest Edge Count to Least:
    - Let Unweighted Edges be the set of Edges in the Current Path which do not yet have a weight.
    - Let the Weighted Edges be the set of Edges in the Current Path which do have a weight.
    - Let the Existing Weight be the sum of the Weights of the Weighted Edges.
        - The sum of no Weights is 0.
    - Assign to each Unweighted Edge a Weight Value equal to the Basis Weight less the Existing Weight, that divided by the Unweighted Edge Count.

Map<VertexId, Vertex> -> Map<VertexId, Map<VertexId, Edge>> -> { Map<VertexId, Progress>, Map<Vertex, Map<Vertex, Weight>> }
vertices -> edges -> { vertexProgresses, edgeWeights }
**/

// import Fraction from 'fraction';
const Fraction = require( 'fraction.js' );

const ARTIFICIAL_START = Symbol( 'artificial start vertex' );
const ARTIFICIAL_END = Symbol( 'artificial end vertex' );
const BASIS_WEIGHT = Fraction( 1 );

// adjacencies: Map<VertexId, Set<VertexId>>
// vertices: Map<VertexId, Vertex>
// edges: Map<VertexId, Map<VertexId, Edge>>

// const balancedDag = exports.balancedDag = function( adjacencies, vertices = defaultVertices( adjacencies ) ) {
const balancedDag = module.exports = exports = function( adjacencies, vertices ) {
	vertices = normalizeVertices( adjacencies, vertices );
	vertices = withArtificialVertices( vertices );
	let edges = edgesWithArtificialVertices( adjacencies, vertices );
	let paths = allPaths( edges );

	edges = balancedEdges( edges, paths );
	vertexProgresses = balancedProgresses( vertices, edges, paths );

	return {
		vertexProgresses: withoutArtificialVertices( vertexProgresses ),
		edgeWeights: withoutArtificialVertexEdges( edges ),
	};
}

exports.ARTIFICIAL_START = ARTIFICIAL_START;
exports.ARTIFICIAL_END = ARTIFICIAL_END;
exports.BASIS_WEIGHT = BASIS_WEIGHT;



//////// Internals

const normalizeVertices = exports.normalizeVertices = function( adjacencies, vertices ) {
	let defaultVertex = () => ({ progress: true });

	if( vertices == null ) {
		vertices = new Map();
	}
	else {
		vertices = new Map( vertices );
	}

	adjacencies.forEach( ( adjs, va ) => {
		if( vertices.has( va ) === false ) {
			vertices.set( va, defaultVertex() );
		}

		adjs.forEach( vb => {
			if( vertices.has( vb ) === false ) {
				vertices.set( vb, defaultVertex() );
			}
		});
	});

	return vertices;
}

const withArtificialVertices = exports.withArtificialVertices = function( vertices ) {
	let verticesWithArtis = new Map( vertices );

	verticesWithArtis.set( ARTIFICIAL_START, { progress: true, artificial: true, boundary: 'source' } );
	verticesWithArtis.set( ARTIFICIAL_END, { progress: false, artificial: true, boundary: 'sink' } );

	return verticesWithArtis;
}

const sourcesAndSinks = exports.sourcesAndSinks = function( adjacencies ) {
	let innerSources = new Set(); // All nodes in the first map
	let innerSinks = new Set(); // All nodes in all second maps

	adjacencies.forEach( ( adjs, va ) => {
		innerSources.add( va );
		adjs.forEach( ( vb ) => {
			innerSinks.add( vb );
		});
	});

	let sources = new Set();
	let sinks = new Set();

	innerSources.forEach( v => {
		if( innerSinks.has( v ) === false ) {
			sources.add( v );
		}
	});

	innerSinks.forEach( v => {
		if( innerSources.has( v ) === false ) {
			sinks.add( v );
		}
	});

	return { sources, sinks };
}

const edgesWithArtificialVertices = exports.edgesWithArtificialVertices = function( adjacencies, vertices ) {
	let { sources, sinks } = sourcesAndSinks( adjacencies );
	let initWeight = ( weight = null ) => ({ weight });
	let edges = new Map();

	adjacencies.forEach( ( adjs, va ) => {
		let adjEdges = new Map();
		edges.set( va, adjEdges );

		adjs.forEach( vb => {
			adjEdges.set( vb, initWeight() );
		});
	});

	let startEdges = new Map();
	edges.set( ARTIFICIAL_START, startEdges );

	sources.forEach( vsourceId => {
		let vsource = vertices.get( vsourceId );
		let weightValue = vsource.progress === false ? Fraction( 0 ) : null;
		startEdges.set( vsourceId, initWeight( weightValue ) );
	});

	sinks.forEach( vsinkId => {
		let endEdges = new Map([
			[ ARTIFICIAL_END, initWeight( Fraction( 0 ) ) ]
		]);

		edges.set( vsinkId, endEdges );
	});

	return edges;
}

// Map<VertexId, Map<VertexId, Edge>> => Array<Path>
const allPaths = exports.allPaths = function( edges ) {
	// simple dfs.
	let dfs = ( edges, vertex = ARTIFICIAL_START, path = [] ) => {
		let currentPath = [ ...path, vertex ];

		if( edges.has( vertex ) === false ) {
			return [ currentPath ];
		}

		let nextEdges = edges.get( vertex );
		let nextPaths = [];

		nextEdges.forEach( ( e, v ) => {
			nextPaths = [ ...nextPaths, ...dfs( edges, v, currentPath ) ];
		});

		return nextPaths;
	}

	let paths = dfs( edges );
	paths.sort( ( a, b ) => b.length - a.length );

	return paths;
}

// impure
const balancedEdges = exports.balancedEdges = function( edges, paths ) {
	// TODO: Group edges by path length, then operate on each group.
	// This should be trivial since they are already sorted.
	// Then, in each group, for each path:
	//   calculate beforehand the number of unweighted edges and order according to the greatest (or least) number.
	//   Then in that order assign weights.
	//     Do not alter the order even though these assignments will inevitably change the number of edges already weighted.

	let pathGroups = new Map();
	let groupings = new Set();

	paths.forEach( path => {
		let group = pathGroups.get( path.length ) || [];
		group.push( path );
		pathGroups.set( path.length, group );

		groupings.add( path.length );
	});

	let sortedGroupings = [ ...groupings ];
	sortedGroupings.sort();
	sortedGroupings.reverse();

	sortedGroupings.forEach( groupIndex => {
		let group = pathGroups.get( groupIndex );

		// Possible optimization: Cache or memoize groupedEdges().
		group.sort( ( a, b ) => {
			let unweightedA = groupedEdges( edges, a ).unweighted;
			let unweightedB = groupedEdges( edges, b ).unweighted;

			return - (unweightedA.size - unweightedB.size);
		});

		group.forEach( path => {
			let { weighted, unweighted } = groupedEdges( edges, path );
			let existing = Fraction( 0 );

			weighted.forEach( e => {
				existing = existing.add( e.weight );
			});

			let remainingWeightPerUnweighted = BASIS_WEIGHT.sub( existing ).div( unweighted.size );

			unweighted.forEach( e => {
				e.weight = remainingWeightPerUnweighted;
			});
		});
	});

	// paths.forEach( path => {
	// 	let { weighted, unweighted } = groupedEdges( edges, path );
	// 	let existing = Fraction( 0 );

	// 	weighted.forEach( e => {
	// 		existing = existing.add( e.weight );
	// 	});

	// 	let remainingWeightPerUnweighted = BASIS_WEIGHT.sub( existing ).div( unweighted.size );

	// 	unweighted.forEach( e => {
	// 		e.weight = remainingWeightPerUnweighted;
	// 	});
	// });

	return edges;
}

const groupedEdges = exports.groupedEdges = function( edges, path ) {
	let unweighted = new Set();
	let weighted = new Set();

	path.forEach( ( va, i ) => {
		if( i == path.length - 1 ) return;

		let vb = path[ i + 1 ];
		let edge = edges.get( va ).get( vb );

		if( edge.weight == null ) {
			unweighted.add( edge );
		}
		else {
			weighted.add( edge );
		}
	});

	return { weighted, unweighted };
}

const balancedProgresses = exports.balancedProgresses = function( vertices, edges, paths ) {
	let vertexProgresses = new Map();

	paths.forEach( path => {
		let progress = Fraction( 0 );

		path.forEach( ( va, vi ) => {
			let vertex = vertices.get( va );

			if( vertexProgresses.has( va ) === false ) {
				vertexProgresses.set( va, {
					progress: Number( progress ),
					progressFraction: progress
				});
			}

			let vb = path[ vi + 1 ];

			if( vb != null ) {
				progress = progress.add( edges.get( va ).get( vb ).weight );
			}
		});
	});

	return vertexProgresses;
}

const withoutArtificialVertices = exports.withoutArtificialVertices = function( vertexProgresses ) {
	// IMPURE! >:I
	vertexProgresses.delete( ARTIFICIAL_START );
	vertexProgresses.delete( ARTIFICIAL_END );

	return vertexProgresses;
}

const withoutArtificialVertexEdges = exports.withoutArtificialVertexEdges = function( edges ) {
	// IMPURE! IMPURE! IMPURE! >:I
	edges.delete( ARTIFICIAL_START );

	edges.forEach( ( abjs, va ) => {
		adjs.delete( ARTIFICIAL_END );
	});

	return edges;
}
