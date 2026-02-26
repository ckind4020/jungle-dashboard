'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Star, MessageCircle, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface GbpSectionProps {
  gbp: any | null
  gbpTotals: {
    search_views: number
    maps_views: number
    total_views: number
    website_clicks: number
    phone_calls: number
    direction_requests: number
    photo_views: number
  }
  gbpTrend: any[]
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
          className={cn('w-3.5 h-3.5', i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300')}
        />
      ))}
    </div>
  )
}

export function GbpSection({ gbp, gbpTotals, gbpTrend, recentReviews, unrepliedCount, locationId }: GbpSectionProps) {
  const hasData = gbp || (gbpTrend && gbpTrend.length > 0)

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900">Google Business Profile</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Star className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No GBP data yet.</p>
          <p className="text-xs text-gray-400 mt-2 max-w-sm">
            Connect your Google Business Profile through Make.com to start tracking reviews, ratings, and how customers discover your business.
          </p>
          <a href={`/hub/${locationId}`} className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium">
            Set Up GBP Integration →
          </a>
        </div>
      </div>
    )
  }

  const totalActions = gbpTotals.website_clicks + gbpTotals.phone_calls + gbpTotals.direction_requests

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-900">Google Business Profile</h3>
      </div>

      {/* 4 KPI mini-cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rating */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Rating</p>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <span className="text-2xl font-bold text-gray-900">
              {gbp?.overall_rating ? Number(gbp.overall_rating).toFixed(1) : '—'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{gbp?.total_review_count || 0} total reviews</p>
        </div>

        {/* Reviews */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Reviews</p>
          <p className="text-2xl font-bold text-gray-900">{gbp?.total_review_count || 0}</p>
          {unrepliedCount > 0 ? (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <MessageCircle className="w-3 h-3" /> {unrepliedCount} need reply
            </span>
          ) : (
            <p className="text-xs text-green-600 mt-1">All replied</p>
          )}
        </div>

        {/* Search Views */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Search Views</p>
          <p className="text-2xl font-bold text-gray-900">{gbpTotals.total_views > 0 ? gbpTotals.total_views.toLocaleString() : gbpTotals.search_views.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">search + maps discovery</p>
        </div>

        {/* Customer Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Actions</p>
          <p className="text-2xl font-bold text-gray-900">{totalActions.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">clicks + calls + directions</p>
        </div>
      </div>

      {/* Discovery Trend Chart */}
      {gbpTrend.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Discovery Over Time</h4>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={gbpTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                labelFormatter={(d) => String(d)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="search_views" name="Search Views" stroke="#4285F4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="maps_views" name="Maps Views" stroke="#34A853" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom row: Customer Actions + Recent Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Customer Actions (period total)</h4>
          <div className="space-y-3">
            <ActionRow label="Website Clicks" value={gbpTotals.website_clicks} />
            <ActionRow label="Phone Calls" value={gbpTotals.phone_calls} />
            <ActionRow label="Direction Requests" value={gbpTotals.direction_requests} />
            <ActionRow label="Photo Views" value={gbpTotals.photo_views} />
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Reviews</h4>

          {unrepliedCount > 0 && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <MessageCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-red-700">{unrepliedCount} review{unrepliedCount > 1 ? 's' : ''} need a reply</span>
            </div>
          )}

          {recentReviews.length > 0 ? (
            <div className="space-y-3">
              {recentReviews.map((review: any, idx: number) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <StarRating rating={review.star_rating} />
                    <span className="text-sm font-medium text-gray-900">{review.reviewer_name}</span>
                    {review.has_reply ? (
                      <span className="text-[10px] font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Replied</span>
                    ) : (
                      <span className="text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Needs Reply</span>
                    )}
                  </div>
                  {review.review_text && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {review.review_text.substring(0, 120)}{review.review_text.length > 120 ? '...' : ''}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {review.review_date ? formatDistanceToNow(new Date(review.review_date), { addSuffix: true }) : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No reviews yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value.toLocaleString()}</span>
    </div>
  )
}
