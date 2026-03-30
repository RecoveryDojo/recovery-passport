import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, TrendingUp, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const LandingPage = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user && role) {
    const home = role === "participant" ? "/card" : role === "peer_specialist" ? "/caseload" : "/admin";
    return <Navigate to={home} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="bg-primary text-primary-foreground px-6 py-20 md:py-32 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Recovery Passport
          </h1>
          <p className="text-xl md:text-2xl text-accent font-medium mb-10">
            Your recovery. Your record. Your future.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button
              asChild
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6 font-semibold"
            >
              <Link to="/signup?role=participant">I'm in Recovery</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 text-lg px-8 py-6 font-semibold"
            >
              <Link to="/signup?role=peer_specialist">I'm a Peer Specialist</Link>
            </Button>
          </div>
          <Link
            to="/login"
            className="text-primary-foreground/70 hover:text-primary-foreground underline text-sm"
          >
            For staff and supervisors →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-card px-6 py-16 md:py-24">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Shield,
              title: "Own Your Story",
              desc: "Your recovery profile follows you everywhere. Fill out paperwork once and carry your progress with you.",
            },
            {
              icon: TrendingUp,
              title: "Track Your Progress",
              desc: "Milestones, assessments, and a recovery plan that shows how far you've come.",
            },
            {
              icon: Link2,
              title: "Share on Your Terms",
              desc: "Generate a verified link for a judge, an employer, or your family. You control what they see.",
            },
          ].map((f) => (
            <div key={f.title} className="text-center p-6">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <f.icon className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-secondary px-6 py-10 text-center">
        <p className="text-foreground/80 text-lg max-w-2xl mx-auto">
          Powered by peer specialists who've been there. Built by Recovery Epicenter Foundation.
        </p>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground px-6 py-12 mt-auto">
        <div className="max-w-3xl mx-auto text-center space-y-2 text-sm">
          <p className="font-semibold text-base">Recovery Epicenter Foundation</p>
          <p>Clearwater, FL</p>
          <a
            href="https://recoveryepicenterfoundation.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline inline-block"
          >
            recoveryepicenterfoundation.org
          </a>
          <p className="text-primary-foreground/70 pt-4">
            For walk-in intake, visit your program location and ask staff for a tablet.
          </p>
          <p className="text-primary-foreground/50 pt-2">
            © {new Date().getFullYear()} Recovery Epicenter Foundation. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
