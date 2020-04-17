export default function useDoc<Content = object | null | undefined>(
  id: string,
  option?: {} | null | undefined,
  initialValue?: (() => Content) | Content
) {}
