"use client";

import BrandTrackerPro from '@/components/brand-tracker-pro';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const LSK_AUTH = "mob_auth_status";

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem(LSK_AUTH) === "true";
    if (!isLoggedIn) {
      router.replace('/login');
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

  if (!isAuthorized) {
    // You can render a loading spinner or null here
    return null;
  }
  
  return <BrandTrackerPro />;
}
