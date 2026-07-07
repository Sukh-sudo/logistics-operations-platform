import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/ViewStates';
import { SearchInput } from '../features/search/SearchInput';
import { SearchResultCard } from '../features/search/SearchResultCard';
import { searchApi } from '../services/search.api';

export function SearchPage() {
  const [input, setInput] = useState('');
  const [barcode, setBarcode] = useState('');
  const search = useQuery({ queryKey: ['search', barcode], queryFn: () => searchApi.findByBarcode(barcode), enabled: Boolean(barcode), retry: false });
  const notFound = axios.isAxiosError(search.error) && search.error.response?.status === 404;

  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h2 className="text-2xl font-semibold text-slate-900">Find an operational asset</h2><p className="mt-2 text-slate-500">Search across packages, containers, and trailers without choosing an asset type first.</p></div>
    <SearchInput value={input} onChange={setInput} onSubmit={() => setBarcode(input.trim())} isSearching={search.isFetching}/>
    {!barcode && <div className="rounded-2xl border border-dashed bg-white"><EmptyState label="Enter an identifier to begin searching"/></div>}
    {search.isFetching && <LoadingState/>}
    {search.data && !search.isFetching && <SearchResultCard result={search.data}/>} 
    {search.isError && !notFound && <ErrorState message="The asset search could not be completed."/>}
    {notFound && <div className="rounded-2xl border bg-white"><EmptyState label={`No asset found for ${barcode}`}/></div>}
  </div>;
}
