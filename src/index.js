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
	if( vertices == null ) {
		vertices = defaultVertices( adjacencies );
	}

	// sources: Set<VertexId>, sinks: Set<VertexId>
	vertices = withArtificialVertices( vertices );
	// let { sources, sinks } = sourcesAndSinks( adjacencies );
	// let edges = edgesWithArtificialVertices( adjacencies, { sources, sinks });
	let edges = edgesWithArtificialVertices( adjacencies );
	let paths = allPaths( edges );

	edges = balancedEdges( edges, paths );
	vertexProgresses = balancedProgresses( vertices, edges, paths );

	return {
		vertexProgresses: withoutArtificialVertices( vertexProgresses ),
		edgeWeights: withoutArtificialVertexEdges( edges ),
	};
}



//////// Internals
// Note: There be dragons down here. (some are impure!)

// adjacencies: Map<VertexId, Set<VertexId>>
// vertices: Map<VertexId, Vertex>
const defaultVertices = exports.defaultVertices = function( adjacencies ) {
	let vertices = new Map();

	adjacencies.forEach( ( adjs, va ) => {
		if( ! vertices.has( va ) ) {
			vertices.set( va, { progress: true });
		}

		adjs.forEach( vb => {
			if( ! vertices.has( vb ) ) {
				vertices.set( vb, { progress: true });
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

const edgesWithSourcesAndSinks = exports.edgesWithSourcesAndSinks = function( adjacencies ) {
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

	sources.forEach( vsource => {
		startEdges.set( vsource, initWeight( vsource.progress === false ? Fraction( 0 ) : null ) );
	});

	sinks.forEach( vsink => {
		let endEdges = new Map([
			[ ARTIFICIAL_END, initWeight( Fraction( 0 ) ) ]
		]);

		edges.set( vsink, endEdges );
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
			nextPaths = [ ...nextPaths, ...dfs( edges, v, path ) ];
		});
	}

	let paths = dfs( edges );
	paths.sort( ( a, b ) => b.length - a.length );

	return paths;
}

// impure
const balancedEdges = exports.balancedEdges = function( edges, paths ) {
	paths.forEach( path => {
		let { weighted, unweighted } = groupedEdges( edges, path );
		let existing = Fraction( 0 );

		weighted.forEach( e => {
			existing.add( e.weight );
		});

		let remainingWeightPerUnweighted = BASIS_WEIGHT.sub( existing ).div( unweighted.size );

		unweighted.forEach( e => {
			e.weight = remainingWeightPerUnweighted;
		});
	});

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
