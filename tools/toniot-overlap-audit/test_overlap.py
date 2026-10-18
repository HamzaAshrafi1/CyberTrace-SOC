import unittest
from audit_overlap import summarize
class Tests(unittest.TestCase):
 def test_known_confusion(self):
  m=summarize([8527,4,4734,492074]);self.assertAlmostEqual(m['macro_f1'],.8888947568155001);self.assertAlmostEqual(m['balanced_accuracy'],.9950011448636095)
 def test_single_class(self):
  m=summarize([0,0,3,97]);self.assertIsNone(m['macro_f1']);self.assertIsNone(m['balanced_accuracy']);self.assertAlmostEqual(m['scanning_false_negative_rate'],.03)
 def test_partition_additivity(self):
  a=[10,2,4,20];b=[3,1,5,11];c=[x+y for x,y in zip(a,b)]
  self.assertEqual(summarize(c)['rows'],summarize(a)['rows']+summarize(b)['rows'])
if __name__=='__main__':unittest.main(verbosity=2)
