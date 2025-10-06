--
-- PostgreSQL database dump
--

\restrict 77RjICGNZtgIMuKz0i58usewrdqwBEPpK2zZN6XAc1MdYX8eNEDwWhDK1q1hqDR

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AccountStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccountStatus" AS ENUM (
    'ACTIVE',
    'TEMPSUSPEND',
    'SUSPENDED'
);


--
-- Name: Category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Category" AS ENUM (
    'BOOKS',
    'CLOTHES',
    'GADGET',
    'FURNITURE',
    'SPORTS',
    'STATIONERY',
    'ELECTRONICS',
    'VEHICLES',
    'MUSIC',
    'OTHERS'
);


--
-- Name: Condition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Condition" AS ENUM (
    'NEW',
    'USED'
);


--
-- Name: ListingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ListingStatus" AS ENUM (
    'ACTIVE',
    'PENDING',
    'SOLD',
    'HIDDEN'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'OFFER_REQUESTED',
    'OFFER_ACCEPTED',
    'OFFER_REJECTED',
    'OFFER_REOFFER',
    'OFFER_COMPLETED'
);


--
-- Name: OfferActor; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OfferActor" AS ENUM (
    'BUYER',
    'SELLER'
);


--
-- Name: OfferStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OfferStatus" AS ENUM (
    'REQUESTED',
    'ACCEPTED',
    'REJECTED',
    'REOFFER',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'USER',
    'ADMIN'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Listing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Listing" (
    id text NOT NULL,
    "sellerId" text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    price integer NOT NULL,
    "imageUrls" text[] DEFAULT ARRAY[]::text[],
    category public."Category" DEFAULT 'OTHERS'::public."Category" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    condition public."Condition" DEFAULT 'USED'::public."Condition" NOT NULL,
    "boostedAt" timestamp(3) without time zone,
    "boostedUntil" timestamp(3) without time zone,
    status public."ListingStatus" DEFAULT 'ACTIVE'::public."ListingStatus" NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type public."NotificationType" NOT NULL,
    "offerId" text,
    "listingId" text,
    title text NOT NULL,
    message text,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Offer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Offer" (
    id text NOT NULL,
    "listingId" text NOT NULL,
    "buyerId" text NOT NULL,
    "sellerId" text NOT NULL,
    status public."OfferStatus" DEFAULT 'REQUESTED'::public."OfferStatus" NOT NULL,
    "meetPlace" text NOT NULL,
    "meetTime" timestamp(3) without time zone NOT NULL,
    note text,
    "rejectReason" text,
    "lastActor" public."OfferActor" DEFAULT 'BUYER'::public."OfferActor" NOT NULL,
    "qrToken" text,
    "qrScannedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Report" (
    id text NOT NULL,
    "targetUserId" text NOT NULL,
    reason text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "authorId" text NOT NULL,
    details text
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "studentId" text,
    email text NOT NULL,
    name text,
    "passwordHash" text NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    "accountStatus" public."AccountStatus" DEFAULT 'ACTIVE'::public."AccountStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "avatarUrl" text,
    bio text,
    "emailVerified" timestamp(3) without time zone,
    "orgDomain" text
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: Listing; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Listing" (id, "sellerId", title, description, price, "imageUrls", category, "createdAt", "updatedAt", condition, "boostedAt", "boostedUntil", status) FROM stdin;
cmgf1abpo0002qd2lqmd1tzsb	cmgf19vty0000qd2lmqvfwaar	Roblox	aaa	111	{https://res.cloudinary.com/duyfwva42/image/upload/v1759749280/r9asfeu36oklrz10pwti.png}	SPORTS	2025-10-06 11:14:41.483	2025-10-06 11:14:41.483	USED	\N	\N	ACTIVE
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", type, "offerId", "listingId", title, message, "isRead", "createdAt") FROM stdin;
\.


--
-- Data for Name: Offer; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Offer" (id, "listingId", "buyerId", "sellerId", status, "meetPlace", "meetTime", note, "rejectReason", "lastActor", "qrToken", "qrScannedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Report; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Report" (id, "targetUserId", reason, "createdAt", "authorId", details) FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, "studentId", email, name, "passwordHash", role, "accountStatus", "createdAt", "updatedAt", "avatarUrl", bio, "emailVerified", "orgDomain") FROM stdin;
cmgf19vty0000qd2lmqvfwaar	\N	66050947@kmitl.ac.th	zoom	$2b$10$wqZLYhUOGKi1YxOMI3LtLesOaGmZN5tUrXFxVUNcZDT7r9bFAcuOW	ADMIN	ACTIVE	2025-10-06 11:14:20.902	2025-10-06 11:41:46.814	\N	\N	\N	kmitl.ac.th
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
73ea8679-3b0e-402e-b347-96c3c953bc84	5defbb09283a324132d31cb1f51f7d0ce519d30db6cea2f4f3de76decd0e1c80	2025-10-06 09:17:12.261998+00	20251003163519_add_category_enum	\N	\N	2025-10-06 09:17:12.206938+00	1
f5c39648-d2a3-4e24-b848-ec10f2cb84d5	74a3354015f66aeab9d74690ee35dd42d41d255c09213b18e11ed68fa221df1e	2025-10-06 09:17:12.270665+00	20251003170739_add_condition_enum	\N	\N	2025-10-06 09:17:12.264065+00	1
9bd7ae92-6d69-4b40-a570-ef100ffefd2d	57187f898f9420e8d02671f54b2cee1adf44dff7b54238a341f43fe2c9278840	2025-10-06 09:17:12.284278+00	20251003172835_add_user_profile_fields_bootstatus	\N	\N	2025-10-06 09:17:12.272306+00	1
58871b1e-5f5d-4e2a-9d7c-45362e1ec97f	b9f95e612740e3810e18d627e154868cc476ad7c6a75db3c141cbb716abd3248	2025-10-06 09:17:12.335622+00	20251004103020_add_offers_notifications	\N	\N	2025-10-06 09:17:12.28754+00	1
dd60ff35-15e3-4691-bf4b-1cd8df5e1c82	14449371959989106aecb9d6d9ae8167579c89b8e967d1252f726080f74c71dc	2025-10-06 09:17:12.35262+00	20251004111242_offer_notif_qr_defaults	\N	\N	2025-10-06 09:17:12.336998+00	1
513ef3c0-4c8e-4943-911c-eb41c81923f9	263bb4be55804ee76a3db4e60095f560d6de2627c527baa3b1d8563b5e49acad	2025-10-06 09:17:12.373975+00	20251004114022_offer_workflow_and_notifications	\N	\N	2025-10-06 09:17:12.354189+00	1
34ede2d1-96f1-43a0-9d82-a04784b1db2c	4725c51b4fcf7d2ec54e091aecbfd73ab4209cf7b736133a99b5bc4fc6a56aa4	2025-10-06 09:17:12.392971+00	20251004161945_adding_relation_noti	\N	\N	2025-10-06 09:17:12.375829+00	1
abec6ee6-f375-456b-8dd8-75315cd3f181	55fd5bdc4adf6b0cab1e4327db23647529e5ca136f9ef6279d8ce04bd8f5704f	2025-10-06 09:17:12.40694+00	20251005131931_use_listing_status_enum_and_pending_flow	\N	\N	2025-10-06 09:17:12.394895+00	1
c4e5c956-4c25-45a3-8cb6-c000bd01c2cc	bd71fb8de272066dacc52c2bb7e3f0d608decdf566e8cd7f02aab9dc61f87d49	2025-10-06 09:17:12.441484+00	20251005133840_new_migrate	\N	\N	2025-10-06 09:17:12.408487+00	1
26b945e1-639f-4342-b8c4-1cfcc89fb519	511c6331e27ad4cf6479cc3a92960ba8dc484ce1c1d4ab2eb4f8d5898d28af06	2025-10-06 09:17:12.491486+00	20251005135449_user_email_only_and_listing_status_enum	\N	\N	2025-10-06 09:17:12.444513+00	1
\.


--
-- Name: Listing Listing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Listing"
    ADD CONSTRAINT "Listing_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Offer Offer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offer"
    ADD CONSTRAINT "Offer_pkey" PRIMARY KEY (id);


--
-- Name: Report Report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Listing_boostedUntil_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Listing_boostedUntil_idx" ON public."Listing" USING btree ("boostedUntil");


--
-- Name: Listing_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Listing_category_idx" ON public."Listing" USING btree (category);


--
-- Name: Listing_sellerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Listing_sellerId_idx" ON public."Listing" USING btree ("sellerId");


--
-- Name: Listing_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Listing_status_createdAt_idx" ON public."Listing" USING btree (status, "createdAt");


--
-- Name: Notification_listingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_listingId_idx" ON public."Notification" USING btree ("listingId");


--
-- Name: Notification_offerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_offerId_idx" ON public."Notification" USING btree ("offerId");


--
-- Name: Notification_userId_isRead_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON public."Notification" USING btree ("userId", "isRead", "createdAt");


--
-- Name: Offer_buyerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offer_buyerId_idx" ON public."Offer" USING btree ("buyerId");


--
-- Name: Offer_listingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offer_listingId_idx" ON public."Offer" USING btree ("listingId");


--
-- Name: Offer_qrToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Offer_qrToken_key" ON public."Offer" USING btree ("qrToken");


--
-- Name: Offer_sellerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offer_sellerId_idx" ON public."Offer" USING btree ("sellerId");


--
-- Name: Offer_status_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offer_status_updatedAt_idx" ON public."Offer" USING btree (status, "updatedAt");


--
-- Name: Report_authorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Report_authorId_idx" ON public."Report" USING btree ("authorId");


--
-- Name: Report_targetUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Report_targetUserId_createdAt_idx" ON public."Report" USING btree ("targetUserId", "createdAt");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Listing Listing_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Listing"
    ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_listingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES public."Listing"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_offerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES public."Offer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Offer Offer_buyerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offer"
    ADD CONSTRAINT "Offer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Offer Offer_listingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offer"
    ADD CONSTRAINT "Offer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES public."Listing"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Offer Offer_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offer"
    ADD CONSTRAINT "Offer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Report Report_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Report Report_targetUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 77RjICGNZtgIMuKz0i58usewrdqwBEPpK2zZN6XAc1MdYX8eNEDwWhDK1q1hqDR

