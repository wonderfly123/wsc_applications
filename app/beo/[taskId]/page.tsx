import { fetchTask } from '@/lib/clickup'
import { BEODocument } from '@/components/BEODocument'

export const dynamic = 'force-dynamic'

export default async function BEOPage({
  params,
}: {
  params: { taskId: string }
}) {
  const data = await fetchTask(params.taskId)

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#878774] font-[family-name:var(--font-jost)]">
        <div className="text-center">
          <h1 className="text-2xl mb-2">BEO Not Found</h1>
          <p className="text-sm text-[#9a9890]">
            This event order could not be located.
          </p>
        </div>
      </div>
    )
  }

  return <BEODocument data={data} />
}
