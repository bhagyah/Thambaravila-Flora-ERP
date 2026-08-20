'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface EventItem {
  id: string;
  enquiryId: string;
  title: string;
  date: string;
  venue: string | null;
  coordinatorName: string | null;
  status: string;
  checklistJson: string | null;
}

export default function CoordinatorPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchEvents();
    }
  }, [session]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = async (eventId: string, currentChecklistJson: string | null, taskId: string) => {
    let checklist: Array<{ id: string; task: string; done: boolean }> = [];
    if (currentChecklistJson) {
      try {
        checklist = JSON.parse(currentChecklistJson);
      } catch (e) {}
    } else {
      checklist = [
        { id: '1', task: 'Venue Confirmed', done: false },
        { id: '2', task: 'Vendor Confirmed', done: false },
        { id: '3', task: 'Flower Order Placed', done: false },
        { id: '4', task: 'Delivery Scheduled', done: false },
      ];
    }

    const updated = checklist.map((item) => (item.id === taskId ? { ...item, done: !item.done } : item));
    const newJson = JSON.stringify(updated);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_CHECKLIST',
          eventId,
          checklistJson: newJson,
        }),
      });

      if (res.ok) {
        fetchEvents();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!session) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Wedding Coordinator Module</h1>
        <p className="text-slate-500 text-sm mt-1">Event calendar, venue confirmations, and floral delivery checklists.</p>
      </div>

      {/* Events List & Interactive Checklists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium col-span-2">Loading coordinator schedule...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 col-span-2">
            No events scheduled. Create events directly from Customer Enquiry pages.
          </div>
        ) : (
          events.map((event) => {
            let checklist: Array<{ id: string; task: string; done: boolean }> = [];
            if (event.checklistJson) {
              try {
                checklist = JSON.parse(event.checklistJson);
              } catch (e) {}
            } else {
              checklist = [
                { id: '1', task: 'Venue Confirmed', done: false },
                { id: '2', task: 'Vendor Confirmed', done: false },
                { id: '3', task: 'Flower Order Placed', done: false },
                { id: '4', task: 'Delivery Scheduled', done: false },
              ];
            }

            const completedCount = checklist.filter((c) => c.done).length;

            return (
              <div key={event.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                      📅 {new Date(event.date).toLocaleDateString()} | 📍 {event.venue || 'Venue TBD'}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-teal-100 text-teal-800 text-xs font-bold rounded-full">
                    {completedCount}/{checklist.length} Tasks
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className="bg-teal-500 h-full transition-all duration-300"
                    style={{ width: `${(completedCount / checklist.length) * 100}%` }}
                  ></div>
                </div>

                {/* Checklist Tasks */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold uppercase text-slate-400">Coordinator Checklist:</span>
                  {checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleChecklistItem(event.id, event.checklistJson, item.id)}
                        className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                      />
                      <span className={item.done ? 'line-through text-slate-400 font-medium' : 'text-slate-700 font-semibold'}>
                        {item.task}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
