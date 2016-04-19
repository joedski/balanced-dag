require( 'babel-register' );

const test = require( 'ava' );
const balancedDag = require( '../src' );
const Fraction = require( 'fraction.js' );



test( "normalizeVertices with no user specified vertices", t => {
	let adjacencies = new Map([
		[ 'foo', new Set([ 'bar', 'baz' ]) ],
		[ 'bar', new Set([ 'baz' ]) ],
		[ 'baz', new Set([ 'bing' ]) ]
	]);

	let vertexMap = balancedDag.normalizeVertices( adjacencies );

	let expectedVertices = new Set([ 'foo', 'bar', 'baz', 'bing' ]);

	t.plan( expectedVertices.size * 2 + 1 );

	t.is( vertexMap.size, expectedVertices.size,
		`generated vertex map has same number of entries as our set of expected vertex ids` );

	vertexMap.forEach( ( v, vid ) => {
		t.true( expectedVertices.has( vid ),
			`vertex ${ vid } is in both received and expected sets` );

		t.is( typeof v.progress, 'boolean',
			`vertex ${ vid } receives a default progress property value of type boolean` );
	});
});



// test( "normalizeVertices with no user specified vertices", t => {
// 	let adjacencies = new Map([
// 		[ 'foo', new Set([ 'bar', 'baz' ]) ],
// 		[ 'bar', new Set([ 'baz' ]) ],
// 		[ 'baz', new Set([ 'bing' ]) ]
// 	]);

// 	let vertices = balancedDag.normalizeVertices( adjacencies, undefined );
// });

test( "normalizeVertices with user specified vertices", t => {
	let adjacencies = new Map([
		[ 'foo', new Set([ 'bar', 'baz' ]) ],
		[ 'bar', new Set([ 'baz' ]) ],
		[ 'baz', new Set([ 'bing' ]) ]
	]);

	let userVerticesAll = new Map([
		[ 'foo', { progress: false } ],
		[ 'bar', { progress: true } ],
		[ 'baz', { progress: true } ],
		[ 'bing', { progress: true } ],
	]);

	let userVerticesSome = new Map([
		[ 'foo', { progress: false } ],
	]);

	let userVerticesAllNormed = balancedDag.normalizeVertices( adjacencies, userVerticesAll );
	let userVerticesSomeNormed = balancedDag.normalizeVertices( adjacencies, userVerticesSome );

	t.not( userVerticesAll, userVerticesAllNormed,
		`the map returned by normalizeVertices is not the same object` );

	t.not( userVerticesSome, userVerticesSomeNormed,
		`the map returned by normalizeVertices is not the same object` );

	t.is( userVerticesAllNormed.size, userVerticesSomeNormed.size,
		`normalizeVertices should return the same size of vertices map given the same adjacencies list` );
});



test( "withArtificialVertices", t => {
	let vertices = new Map([
		[ 'foo', { progress: true } ],
		[ 'bar', { progress: true } ],
		[ 'baz', { progress: true } ],
		[ 'bing', { progress: true } ],
	]);

	let verticesWithArtis = balancedDag.withArtificialVertices( vertices );

	t.is( verticesWithArtis.size, vertices.size + 2,
		`should create a new map with size 2 greater than the original vertex map` );

	t.true( verticesWithArtis.has( balancedDag.ARTIFICIAL_START ),
		`new map should have an ARTIFICIAL_START vertex` );

	t.true( verticesWithArtis.has( balancedDag.ARTIFICIAL_END ),
		`new map should have an ARTIFICIAL_END vertex` );
});



test( "sourcesAndSinks", t => {
	let adjacencies = new Map([
		[ 'foo', new Set([ 'bar', 'baz' ]) ],
		[ 'zip', new Set([ 'bar', 'zappity' ]) ],
		[ 'bar', new Set([ 'baz' ]) ],
		[ 'zappity', new Set([ 'zop', 'zoop' ]) ],
		[ 'zop', new Set([ 'bing' ]) ],
		[ 'baz', new Set([ 'bing' ]) ],
	]);

	let { sources, sinks } = balancedDag.sourcesAndSinks( adjacencies );

	t.is( sources.size, 2,
		`test set should yield 2 sources` );

	t.is( sinks.size, 2,
		`test set should yield 2 sinks` );

	t.true(	sources.has( 'foo' ) && sources.has( 'zip' ),
		`sources should be 'foo' and 'zip'` );

	t.true( sinks.has( 'zoop' ) && sinks.has( 'bing' ),
		`sinks should be 'zoop' and 'bing'` );
});



test( "edgesWithArtificialVertices and default vertices", t => {
	let adjacencies = new Map([
		[ 'foo', new Set([ 'bar', 'baz' ]) ],
		[ 'zip', new Set([ 'bar', 'zappity' ]) ],
		[ 'bar', new Set([ 'baz' ]) ],
		[ 'zappity', new Set([ 'zop', 'zoop' ]) ],
		[ 'zop', new Set([ 'bing' ]) ],
		[ 'baz', new Set([ 'bing' ]) ],
	]);

	let vertices = balancedDag.withArtificialVertices( balancedDag.normalizeVertices( adjacencies ) );

	let { sources, sinks } = balancedDag.sourcesAndSinks( adjacencies );

	let edges = balancedDag.edgesWithArtificialVertices( adjacencies, vertices );

	adjacencies.forEach( ( adjs, va ) => {
		t.true( edges.has( va ) );

		adjs.forEach( vb => {
			t.true( edges.get( va ).has( vb ) );
			t.true( 'weight' in edges.get( va ).get( vb ) );
			t.true( edges.get( va ).get( vb ).weight == null );
		});
	});

	t.true( edges.has( balancedDag.ARTIFICIAL_START ) );

	sinks.forEach( v => {
		t.true( edges.get( v ).has( balancedDag.ARTIFICIAL_END ) );
		t.true( 'weight' in edges.get( v ).get( balancedDag.ARTIFICIAL_END ) );
		// While by default
		t.true( edges.get( v ).get( balancedDag.ARTIFICIAL_END ).weight instanceof Fraction );
	});
});



test( "allPaths", t => {
	// Done up in mermaid, with the number of paths possible, found using the reverse-counting method.
	// https://knsv.github.io/mermaid/live_editor/#/edit/Z3JhcGggTFI7Cgpmb29bImZvbyAoMikiXQpiYXJbImJhciAoMSkiXQpiYXpbImJheiAoMSkiXQpiaW5nWyJiaW5nICgxKSJdCnppcFsiemlwICgzKSJdCnphcHBpdHlbInphcHBpdHkgKDIpIl0Kem9wWyJ6b3AgKDEpIl0Kem9vcFsiem9vcCAoMSkiXQoKQV9TVEFSVCgoIlNUQVJUICg1KSIpKQpBX1NUQVJUIC0tPiBmb28KQV9TVEFSVCAtLT4gemlwCgpmb28gLS0-IGJhcgpmb28gLS0-IGJhegp6aXAgLS0-IGJhcgp6aXAgLS0-IHphcHBpdHkKYmFyIC0tPiBiYXoKemFwcGl0eSAtLT4gem9wCnphcHBpdHkgLS0-IHpvb3AKem9wIC0tPiBiaW5nCmJheiAtLT4gYmluZwoKQV9FTkQoKCJFTkQgKDEpIikpCmJpbmcgLS0-IEFfRU5ECnpvb3AgLS0-IEFfRU5E

	let adjacencies = new Map([
		[ 'foo', new Set([ 'bar', 'baz' ]) ],
		[ 'zip', new Set([ 'bar', 'zappity' ]) ],
		[ 'bar', new Set([ 'baz' ]) ],
		[ 'zappity', new Set([ 'zop', 'zoop' ]) ],
		[ 'zop', new Set([ 'bing' ]) ],
		[ 'baz', new Set([ 'bing' ]) ],
	]);

	let vertices = balancedDag.withArtificialVertices( balancedDag.normalizeVertices( adjacencies ) );

	let { sources, sinks } = balancedDag.sourcesAndSinks( adjacencies );

	let edges = balancedDag.edgesWithArtificialVertices( adjacencies, vertices );

	let paths = balancedDag.allPaths( edges );

	t.is( paths.length, 5,
		`The provided graph should have 5 paths from ARTIFICIAL_START to ARTIFICIAL_END` );

	t.true( paths.every( ( p, pi ) => {
		let pn = paths[ pi + 1 ];

		if( ! pn ) return true;

		return p.length >= pn.length;
	}),
		`paths are sorted to be greatest length first` );

	t.true( paths.every( p => {
		return sources.has( p[ 1 ] );
	}),
		`second vertex of each path is one of the source vertices` );

	t.true( paths.every( p => {
		return sinks.has( p[ p.length - 2 ] );
	}),
		`second-to-last vertex of each path is one of the sink vertices` );
});



test( "groupedEdges", t => {
	let adjacencies = new Map([
		[ 'foo', new Set([ 'bar', 'baz' ]) ],
		[ 'zip', new Set([ 'bar', 'zappity' ]) ],
		[ 'bar', new Set([ 'baz' ]) ],
		[ 'zappity', new Set([ 'zop', 'zoop' ]) ],
		[ 'zop', new Set([ 'bing' ]) ],
		[ 'baz', new Set([ 'bing' ]) ],
	]);
	let vertices = balancedDag.withArtificialVertices( balancedDag.normalizeVertices( adjacencies ) );
	let { sources, sinks } = balancedDag.sourcesAndSinks( adjacencies );
	let edges = balancedDag.edgesWithArtificialVertices( adjacencies, vertices );
	let paths = balancedDag.allPaths( edges );

	// First, test non-modification.
	paths.forEach( path => {
		let { weighted, unweighted } = balancedDag.groupedEdges( edges, path );

		t.is( unweighted.size, path.length - 2,
			`when all edges (except those to ARTIFICIAL_END) are unweighted, the unweighted count should be the number of vertices in the path less 2` );
	});

	// Now, start modifying things.
})



test( "balancedEdges", t => {
	let adjacencies = new Map([
		[ 'foo', new Set([ 'bar', 'baz' ]) ],
		[ 'zip', new Set([ 'bar', 'zappity' ]) ],
		[ 'bar', new Set([ 'baz' ]) ],
		[ 'zappity', new Set([ 'zop', 'zoop' ]) ],
		[ 'zop', new Set([ 'bing' ]) ],
		[ 'baz', new Set([ 'bing' ]) ],
	]);
	let vertices = balancedDag.withArtificialVertices( balancedDag.normalizeVertices( adjacencies ) );
	let { sources, sinks } = balancedDag.sourcesAndSinks( adjacencies );
	let edges = balancedDag.edgesWithArtificialVertices( adjacencies, vertices );
	let paths = balancedDag.allPaths( edges );

	// Done this way because balancedEdges is currently impure.
	let balancedEdges = balancedDag.balancedEdges(
		balancedDag.edgesWithArtificialVertices( adjacencies, vertices ),
		paths
	);

	paths.forEach( p => {
		let edgeWeights = p.reduce( ( weights, vid, vidi ) => {
			let vnid = p[ vidi + 1 ];

			if( ! vnid ) return weights;

			return [ ...weights, balancedEdges.get( vid ).get( vnid ).weight ];
		}, [] );

		// console.log( p, `has the edge weights` );
		// console.log( '\t', edgeWeights.map( ew => ew.toFraction() ) );

		let sum = p.reduce( ( sum, vid, vidi ) => {
			let vnid = p[ vidi + 1 ];

			if( ! vnid ) return sum;

			return sum.add( balancedEdges.get( vid ).get( vnid ).weight );
		}, Fraction( 0 ));

		t.is( Number( sum ), 1,
			`each path sums to a weight of 1` );
	});
});



test.todo( "balancedProgresses" );
/**
Thoughts:
Get the paths and balanced edge weights,
then, use balancedProgresses to calculate the progresses in each path way.
then iterate through each path and:
	manually calculate the vertex progresses in each path in isolation.
	Then, compare the re
**/
