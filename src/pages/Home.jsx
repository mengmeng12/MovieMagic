import { getPopular, getTrending, getUpcoming } from '../lib/tmdb';
import { useAsync } from '../lib/useAsync';
import MovieGrid from '../components/MovieGrid';
import Status from '../components/Status';

const SECTIONS = [
  ['Trending This Week', getTrending],
  ['Popular', getPopular],
  ['Upcoming', getUpcoming],
];

function Section({ title, fetcher }) {
  const state = useAsync(fetcher, [fetcher]);
  return (
    <section>
      <h2>{title}</h2>
      <Status state={state} />
      {state.data && <MovieGrid movies={state.data} row />}
    </section>
  );
}

export default function Home() {
  return SECTIONS.map(([title, fetcher]) => <Section key={title} title={title} fetcher={fetcher} />);
}
