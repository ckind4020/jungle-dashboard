'use client'

import { Star, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface GbpCardProps {
  gbp: any | null
  recentReviews: any[]
  unrepliedCount: number
  locationId: string
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn('w-4 h-4', i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300')}
        />
      ))}
    </div>
  )
}

export function GbpCard({ gbp, recentReviews, unrepliedCount, locationId }: GbpCardProps) {
  if (!gbp) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Google Business Profile</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Star className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No Google Business Profile data yet.</p>
          <p className="text-xs text-gray-400 mt-1">Set up GBP integration on your Hub.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Google Business Profile</h3>

      {/* Header stats */}
      <div className="flex items-center gap-6 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
          <span className="text-3xl font-bold text-gray-900">{Number(gbp.overall_rating).toFixed(1)}</span>
        </div>
        <div className="text-sm text-gray-500">
          {gbp.total_review_count || 0} reviews
        </div>
        {unrepliedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <MessageCircle className="w-3 h-3" /> {unrepliedCount} unreplied
          </span>
        )}
      </div>

      {/* GBP Discovery Metrics */}
      {(gbp.search_views || gbp.maps_views || gbp.website_clicks || gbp.phone_calls) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {gbp.search_views != null && (
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{Number(gbp.search_views).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Search Views</p>
            </div>
          )}
          {gbp.maps_views != null && (
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{Number(gbp.maps_views).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Maps Views</p>
            </div>
          )}
          {gbp.website_clicks != null && (
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{Number(gbp.website_clicks).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Website Clicks</p>
            </div>
          )}
          {gbp.phone_calls != null && (
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{Number(gbp.phone_calls).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Phone Calls</p>
            </div>
          )}
        </div>
      )}

      {/* Recent Reviews */}
      {recentReviews.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Reviews</h4>
          <div className="space-y-3">
            {recentReviews.map((review, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StarRating rating={review.star_rating} />
                    <span className="text-sm font-medium text-gray-900">{review.reviewer_name}</span>
                    {review.has_reply && (
                      <span className="text-[10px] font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Replied</span>
                    )}
                    {!review.has_reply && (
                      <span className="text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Needs Reply</span>
                    )}
                  </div>
                  {review.review_text && (
                    <p className="text-xs text-gray-600 line-clamp-2">{review.review_text.substring(0, 120)}{review.review_text.length > 120 ? '...' : ''}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {review.review_date ? formatDistanceToNow(new Date(review.review_date), { addSuffix: true }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
