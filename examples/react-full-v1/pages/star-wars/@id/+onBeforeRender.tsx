// https://vike.dev/onBeforeRender

import fetch from 'cross-fetch'
import { filterMovieData } from '../filterMovieData'
import type { Config, PageContextClient, PageContextServer } from 'vike/types'
import type { MovieDetails } from '../types'
import { render } from 'vike/abort'
import React from 'react'

// NOTE(aurelien): this is still my favorite style as a user. And as a Vike contributor I'll
// probably personally advertise for this.
const onBeforeRender: Config['onBeforeRender'] = async (
  pageContext: PageContextServer | PageContextClient
): Promise<{ pageContext: Partial<Vike.PageContext> }> => {
  const dataUrl = `https://star-wars.brillout.com/api/films/${pageContext.routeParams?.id}.json`
  let movie: MovieDetails
  try {
    const response = await fetch(dataUrl)
    movie = (await response.json()) as MovieDetails
  } catch (err) {
    console.error(err)
    //*/
    throw render(503, `Couldn't fetch data, because failed HTTP GET request to ${dataUrl}`)
    /*/
    throw render(
      503,
      <>
        Couldn't fetch data, because failed HTTP GET request to <code>{dataUrl}</code>.
      </>
    )
    //*/
  }

  // We remove data we don't need because we pass `pageContext.movie` to
  // the client; we want to minimize what is sent over the network.
  movie = filterMovieData(movie)

  const { title } = movie

  return {
    pageContext: {
      pageProps: {
        movie
      },
      // The page's <title>
      title
    }
  }
}
export default onBeforeRender
